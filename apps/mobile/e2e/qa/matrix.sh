#!/usr/bin/env bash
# iOS device matrix on the Release build: each device × light, dark and the largest accessibility text size runs
# _matrix-tour.yaml; screenshots land in harness/state/screens/final/ios-<device>-<mode>/.
#   e2e/qa/matrix.sh                     # every device and mode
#   DEVICES="SE3" MODES="light" e2e/qa/matrix.sh
set -uo pipefail
cd "$(dirname "$0")/../.."

export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
APP=${APP:-$(ls -td ~/Library/Developer/Xcode/DerivedData/DaycareWatch-*/Build/Products/Release-iphonesimulator/DaycareWatch.app | head -1)}
# The QA team's own simulators (never another terminal's): name → "DW QA <name>".
DEVICES=${DEVICES:-"SE3 17 ProMax iPad"}
MODES=${MODES:-"light dark xxxl"}
udid() {
  case "$1" in
    ProMax) echo 097582E0-1C3E-4179-81B5-45BD006D2B3A ;;
    *) xcrun simctl list devices | grep "DW QA $1 (" | grep -oE '[0-9A-F-]{36}' | head -1 ;;
  esac
}

pass=0; fail=0; failed=()
for dev in $DEVICES; do
  id=$(udid "$dev")
  [ -n "$id" ] || { echo "no simulator DW QA $dev"; fail=$((fail + 1)); continue; }
  xcrun simctl boot "$id" 2>/dev/null; xcrun simctl bootstatus "$id" -b >/dev/null
  xcrun simctl install "$id" "$APP"
  xcrun simctl location "$id" set 33.0198,-96.6989
  xcrun simctl privacy "$id" grant location com.areebhirani.daycare-watch
  for mode in $MODES; do
    xcrun simctl ui "$id" appearance "$([ "$mode" = dark ] && echo dark || echo light)"
    xcrun simctl ui "$id" content_size "$([ "$mode" = xxxl ] && echo accessibility-extra-extra-extra-large || echo large)"
    shots="../../harness/state/screens/final/ios-$dev-$mode"
    mkdir -p "$shots"
    if maestro --device "$id" test -e SHOTS="$shots" e2e/qa/_matrix-tour.yaml >"$shots/maestro.log" 2>&1; then
      pass=$((pass + 1)); echo "  ok   $dev $mode"
    else
      fail=$((fail + 1)); failed+=("$dev-$mode"); echo "  FAIL $dev $mode ($(grep -m1 -E 'FAILED|Element not found|Assertion' "$shots/maestro.log"))"
    fi
  done
  xcrun simctl ui "$id" appearance light; xcrun simctl ui "$id" content_size large
done
echo "matrix: $pass passed, $fail failed ${failed[*]:-}"
[ "$fail" = 0 ]
