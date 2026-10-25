#!/usr/bin/env bash
# QA U21 + U23 on the Release build in the QA simulator: a replayed alert for Viva World School (1459611) is tapped
# with the app (a) in the background and (b) not running, and must open that alert. The payload comes from
# e2e/journey.sh, so it is pipeline's real message. Needs the local stack and the Release build (npx expo run:ios
# --configuration Release); no Metro.
set -euo pipefail
cd "$(dirname "$0")/../.."

export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
DEVICE=${QA_DEVICE:-097582E0-1C3E-4179-81B5-45BD006D2B3A}
BUNDLE=com.areebhirani.daycare-watch
APP=${APP:-$(ls -td ~/Library/Developer/Xcode/DerivedData/DaycareWatch-*/Build/Products/Release-iphonesimulator/DaycareWatch.app | head -1)}
mkdir -p ../../harness/state/qa

xcrun simctl boot "$DEVICE" 2>/dev/null; xcrun simctl bootstatus "$DEVICE" -b >/dev/null
xcrun simctl location "$DEVICE" set 33.0198,-96.6989
xcrun simctl install "$DEVICE" "$APP"
payload=$(mktemp -t pushtap).apns
DEVICE="$DEVICE" PAYLOAD_ONLY=1 PAYLOAD="$payload" e2e/journey.sh >/dev/null

maestro --device "$DEVICE" test e2e/qa/_release-watch-viva.yaml

# Maestro starts at its own pace and a banner stays about 5 s, so push only once the flow is looking for it.
tap_push() { # flow
  local log rc=0 mpid
  log=$(mktemp -t pushtap)
  maestro --device "$DEVICE" test "$1" >"$log" 2>&1 &
  mpid=$!
  until grep -q "Assert that" "$log" 2>/dev/null || ! kill -0 "$mpid" 2>/dev/null; do sleep 0.5; done
  sleep 1
  xcrun simctl push "$DEVICE" "$BUNDLE" "$payload"
  wait "$mpid" || rc=$?
  cat "$log"; rm -f "$log"
  return "$rc"
}

echo "== U23: background"
xcrun simctl launch "$DEVICE" "$BUNDLE" >/dev/null
sleep 3
maestro --device "$DEVICE" test e2e/qa/_home.yaml
tap_push e2e/qa/r23-push-background.yaml

echo "== U21: not running"
xcrun simctl terminate "$DEVICE" "$BUNDLE"
sleep 2
tap_push e2e/qa/r21-push-cold.yaml
rm -f "$payload"
echo "push-tap: U23 background + U21 cold COMPLETED"
