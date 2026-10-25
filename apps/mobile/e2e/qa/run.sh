#!/usr/bin/env bash
# QA flows on the QA simulator (iPhone 17 Pro Max) in Expo Go against the running Metro + local stack.
#   e2e/qa/run.sh                 # every flow
#   e2e/qa/run.sh u01-first-launch # one flow
# Screenshots land in harness/state/qa/.
set -uo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
DEVICE=${QA_DEVICE:-097582E0-1C3E-4179-81B5-45BD006D2B3A}
METRO=${METRO:-exp://$(ipconfig getifaddr en0):8081}
mkdir -p ../../harness/state/qa

# A fixed spot in Plano (inside TX-04's metro area) so distances are repeatable.
xcrun simctl location "$DEVICE" set 33.0198,-96.6989
xcrun simctl ui "$DEVICE" appearance light
xcrun simctl ui "$DEVICE" content_size large

flows=("$@")
[[ ${#flows[@]} -eq 0 ]] && flows=($(ls e2e/qa/u*.yaml | xargs -n1 basename | sed 's/\.yaml$//'))

pass=0; fail=0; failed=()
for f in "${flows[@]}"; do
  [[ "$f" == u01-* ]] && xcrun simctl privacy "$DEVICE" reset location host.exp.Exponent
  if maestro --device "$DEVICE" test -e METRO="$METRO" "e2e/qa/$f.yaml"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1)); failed+=("$f")
  fi
done
echo "QA: $pass passed, $fail failed ${failed[*]:-}"
[[ $fail -eq 0 ]]
