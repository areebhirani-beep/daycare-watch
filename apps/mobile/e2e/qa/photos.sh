#!/usr/bin/env bash
# Photos QA on the Release build (Look Around needs the native module, so not Expo Go): onboard once, then
# capture every carousel page of 20 TX-04 centers into harness/state/screens/final/photos-<stamp>/.
set -uo pipefail
cd "$(dirname "$0")/../.."
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
DEVICE=${QA_DEVICE:-097582E0-1C3E-4179-81B5-45BD006D2B3A}
APP=${APP:-$(ls -td ~/Library/Developer/Xcode/DerivedData/DaycareWatch-*/Build/Products/Release-iphonesimulator/DaycareWatch.app | head -1)}
shots="../../harness/state/screens/final/photos-$(date +%H%M)"
mkdir -p "$shots"
xcrun simctl ui "$DEVICE" appearance light
xcrun simctl location "$DEVICE" set 33.0198,-96.6989
xcrun simctl install "$DEVICE" "$APP"
maestro --device "$DEVICE" test e2e/qa/_release-watch-viva.yaml >/dev/null || { echo "onboarding failed"; exit 1; }
maestro --device "$DEVICE" test -e SHOTS="$shots" e2e/qa/_photos-20.yaml
echo "screens in $shots"
