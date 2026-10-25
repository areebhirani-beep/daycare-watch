#!/usr/bin/env bash
# Records one video clip: runs the setup steps (unrecorded), then records FLOW, trims to the moment FLOW
# starts, and writes an h264, 30 fps constant-rate MP4. A setup step is a flow, or loc=<lat>,<lng> to move
# the simulator's location.
# With PUSH=<payload.apns>, the payload is pushed a second after the flow presses the Home key.
#   QA_DEVICE=<udid> e2e/qa/clips/clip.sh <out.mp4> <flow.yaml> [setup.yaml | loc=<lat>,<lng>]...
set -euo pipefail
cd "$(dirname "$0")/../../.."
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
DEVICE=${QA_DEVICE:?set QA_DEVICE}
out=$1 flow=$2
shift 2
raw=$(mktemp -t clip).mov
xcrun simctl status_bar "$DEVICE" override --time 9:41 --batteryState discharging --batteryLevel 100 --wifiBars 3 --cellularBars 4
for step in "$@"; do
  case $step in
    loc=*) xcrun simctl location "$DEVICE" set "${step#loc=}" ;;
    *) maestro --device "$DEVICE" test "$step" >"$raw.setup.log" 2>&1 || { tail -20 "$raw.setup.log"; exit 1; } ;;
  esac
done
xcrun simctl io "$DEVICE" recordVideo --codec=h264 --force "$raw" 2>/dev/null &
rec=$!
trap 'kill -INT "$rec" 2>/dev/null || true' EXIT
sleep 1
t0=$(python3 -c 'import time;print(time.time())')
log=$(mktemp -t clip)
maestro --device "$DEVICE" test "$flow" >"$log" 2>&1 &
mp=$!
if [ -n "${PUSH:-}" ]; then
  ( until grep -q "Press Home key... COMPLETED" "$log" 2>/dev/null; do sleep 0.2; done
    sleep 1; xcrun simctl push "$DEVICE" com.areebhirani.daycare-watch "$PUSH" >/dev/null ) &
fi
# Maestro spends a few seconds connecting before the flow's first command. Every clip flow opens with a
# FIRST-second hold, so the first logged step ends FIRST seconds after the clip should begin.
until grep -q "COMPLETED\|WARNED\|FAILED" "$log" 2>/dev/null || ! kill -0 "$mp" 2>/dev/null; do sleep 0.1; done
start=$(python3 -c "import time;print(max(0, time.time()-$t0+1-${FIRST:-4}-0.2))")
wait "$mp" || { cat "$log"; exit 1; }
sleep 0.5
kill -INT "$rec"; wait "$rec" 2>/dev/null || true; trap - EXIT
ffmpeg -v error -y -ss "$start" -i "$raw" -r 30 -fps_mode cfr -c:v libx264 -pix_fmt yuv420p -crf 18 -an "$out"
rm -f "$raw" "$log"
echo "$out $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out") s"
