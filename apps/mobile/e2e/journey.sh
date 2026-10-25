#!/usr/bin/env bash
# Parent journey on the iOS simulator: find -> record -> watch -> alert.
# The alert is pipeline's replay of a real state finding (event 45, nc 1022378716, Viva World School),
# delivered with simctl because the simulator has no Expo push token.
# Needs: local Supabase stack, Metro (npx expo start --dev-client), the dev build on a booted simulator.
set -euo pipefail
# Maestro resolves screenshot paths from the working directory, so run from apps/mobile.
cd "$(dirname "$0")/.."

export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
BUNDLE=com.areebhirani.daycare-watch
EVENT_ID=${EVENT_ID:-45}

maestro test e2e/journey-find-watch.yaml

payload=$(mktemp -t journey).apns
cat >"$payload" <<JSON
{"Simulator Target Bundle":"$BUNDLE","aps":{"alert":{"title":"Viva World School","body":"Replay of a real state record from Oct 5, 2026: The state posted 1 new finding from a visit on Oct 5, 2026. Tap to read what inspectors wrote."},"sound":"default"},"body":{"event_id":$EVENT_ID,"operation_id":1459611,"kind":"new_violation","is_replay":true,"activity_id":903987067}}
JSON
# Fire the push once Maestro is up, so it taps the live banner (Notification Center taps don't open the app in the iOS 26 simulator).
(sleep 12 && xcrun simctl push booted "$BUNDLE" "$payload" && rm -f "$payload") &
maestro test e2e/alert-tap.yaml
wait
echo "journey: find -> record -> watch -> alert COMPLETED"
