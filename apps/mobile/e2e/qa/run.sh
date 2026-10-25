#!/usr/bin/env bash
# QA flows on the QA simulator (iPhone 17 Pro Max) in Expo Go against the running Metro + local stack.
#   e2e/qa/run.sh                 # every flow
#   e2e/qa/run.sh u01-first-launch # one flow
# Screenshots land in e2e/out/qa/.
set -uo pipefail
cd "$(dirname "$0")/../.."

export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
DEVICE=${QA_DEVICE:-097582E0-1C3E-4179-81B5-45BD006D2B3A}
METRO=${METRO:-exp://$(ipconfig getifaddr en0):8081}
mkdir -p e2e/out/qa

# A fixed spot in Plano (inside TX-04's metro area) so distances are repeatable.
xcrun simctl location "$DEVICE" set 33.0198,-96.6989
xcrun simctl ui "$DEVICE" appearance light
xcrun simctl ui "$DEVICE" content_size large

flows=("$@")
[[ ${#flows[@]} -eq 0 ]] && flows=($(ls e2e/qa/[um][0-9]*.yaml | xargs -n1 basename | sed 's/\.yaml$//'))

pass=0; fail=0; failed=()
for f in "${flows[@]}"; do
  [[ "$f" == u01-* ]] && xcrun simctl privacy "$DEVICE" reset location host.exp.Exponent
  [[ "$f" == u03-* ]] && xcrun simctl privacy "$DEVICE" revoke location host.exp.Exponent
  [[ "$f" == u28-* ]] && xcrun simctl ui "$DEVICE" appearance dark
  [[ "$f" == m04-* ]] && xcrun simctl spawn "$DEVICE" defaults write com.apple.Accessibility ReduceMotionEnabled -bool true
  [[ "$f" == u29-* ]] && xcrun simctl ui "$DEVICE" content_size accessibility-extra-extra-extra-large
  if [[ "$f" == u04-* ]]; then
    xcrun simctl privacy "$DEVICE" grant location host.exp.Exponent
    xcrun simctl location "$DEVICE" set 35.4676,-97.5164
  fi
  ok=1
  maestro --device "$DEVICE" test -e METRO="$METRO" "e2e/qa/$f.yaml" || ok=0
  # M4: with Reduce Motion on, the 3D hero must hold still. Two hero crops 8 s apart must match
  # (the same check with Reduce Motion off changes ~680k of 924k pixels).
  if [[ $ok == 1 && "$f" == m04-* ]]; then
    tmp=$(mktemp -d); perl -e 'sleep 5'
    xcrun simctl io "$DEVICE" screenshot "$tmp/a.png" >/dev/null 2>&1; perl -e 'sleep 8'
    xcrun simctl io "$DEVICE" screenshot "$tmp/b.png" >/dev/null 2>&1
    for x in a b; do ffmpeg -loglevel error -y -i "$tmp/$x.png" -vf "crop=1320:700:0:150" -f rawvideo -pix_fmt gray "$tmp/$x.raw"; done
    moved=$(python3 -c "a=open('$tmp/a.raw','rb').read(); b=open('$tmp/b.raw','rb').read(); print(sum(1 for x,y in zip(a,b) if abs(x-y)>12))")
    echo "m04: $moved hero pixels changed in 8 s (must be under 2000)"
    [[ $moved -lt 2000 ]] || ok=0
    rm -rf "$tmp"
  fi
  if [[ $ok == 1 ]]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1)); failed+=("$f")
  fi
  [[ "$f" == u28-* ]] && xcrun simctl ui "$DEVICE" appearance light
  [[ "$f" == m04-* ]] && xcrun simctl spawn "$DEVICE" defaults write com.apple.Accessibility ReduceMotionEnabled -bool false
  [[ "$f" == u29-* ]] && xcrun simctl ui "$DEVICE" content_size large
  if [[ "$f" == u03-* || "$f" == u04-* ]]; then
    xcrun simctl privacy "$DEVICE" grant location host.exp.Exponent
    xcrun simctl location "$DEVICE" set 33.0198,-96.6989
  fi
done
echo "QA: $pass passed, $fail failed ${failed[*]:-}"
[[ $fail -eq 0 ]]
