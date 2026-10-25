#!/usr/bin/env bash
# Filming check on one iPhone 17 Pro simulator, Release build, light mode: records the whole parent path
# (onboarding with alerts allowed, watch Viva World School, its photos and record, Your rights, then a
# replayed alert arriving in the background and tapped) and flags frames worth a look:
#   flash  = a frame much brighter or darker than both neighbors (a white or black flash)
#   cut    = a large change between frames (expected on taps; look for ones with no tap)
#   freeze = the picture holds still for 1.5 s or more mid-flow
# Needs the local stack and a Release build; ffmpeg for the analysis.
#   QA_DEVICE=<udid> APP=<path to .app> e2e/qa/film.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
DEVICE=${QA_DEVICE:?set QA_DEVICE to the simulator udid}
BUNDLE=com.areebhirani.daycare-watch
APP=${APP:-$(ls -td ~/Library/Developer/Xcode/DerivedData/DaycareWatch-*/Build/Products/Release-iphonesimulator/DaycareWatch.app | head -1)}
OUT=${OUT:-e2e/out/film-$(date +%H%M)}
mkdir -p "$OUT/frames" e2e/out/qa
OUT=$(cd "$OUT" && pwd)

xcrun simctl boot "$DEVICE" 2>/dev/null || true; xcrun simctl bootstatus "$DEVICE" -b >/dev/null
xcrun simctl ui "$DEVICE" appearance light
xcrun simctl ui "$DEVICE" content_size large
xcrun simctl status_bar "$DEVICE" override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4
xcrun simctl location "$DEVICE" set 33.0198,-96.6989
xcrun simctl uninstall "$DEVICE" "$BUNDLE" 2>/dev/null || true
xcrun simctl install "$DEVICE" "$APP"
payload="$OUT/replay.apns"
DEVICE="$DEVICE" PAYLOAD_ONLY=1 PAYLOAD="$payload" e2e/journey.sh >/dev/null

# Each Maestro step is stamped with seconds since the recording began, so a flagged frame maps to a step.
xcrun simctl io "$DEVICE" recordVideo --codec=h264 --force "$OUT/film.mp4" 2>"$OUT/record.log" &
rec=$!
trap 'kill -INT "$rec" 2>/dev/null || true' EXIT
sleep 2
t0=$(python3 -c 'import time;print(time.time())')
now() { python3 -c "import time;print(f'{time.time()-$t0:7.2f}')"; }
step() { echo "$(now)  == $1" >>"$OUT/steps.log"; }
# A failed step is logged and the recording goes on, so one miss still leaves a video to review.
run() { { maestro --device "$DEVICE" test "$1" 2>&1 || echo "STEP FAILED: $1"; } | while IFS= read -r l; do echo "$(now)  $l"; done >>"$OUT/steps.log"; }

step "onboarding, watch Viva World School"; run e2e/qa/_release-watch-viva.yaml
step "photos, record, Your rights";         run e2e/qa/_film-place.yaml
step "background, replayed alert arrives";  run e2e/qa/_home.yaml
log=$(mktemp -t film)
maestro --device "$DEVICE" test e2e/qa/r23-push-background.yaml >"$log" 2>&1 &
mp=$!
until grep -q "Assert that" "$log" 2>/dev/null || ! kill -0 "$mp" 2>/dev/null; do sleep 0.5; done
sleep 1; step "push sent"; xcrun simctl push "$DEVICE" "$BUNDLE" "$payload" >/dev/null
wait "$mp" || true; while IFS= read -r l; do echo "$(now)  $l"; done <"$log" >>"$OUT/steps.log"; rm -f "$log"
step "done"; sleep 2
kill -INT "$rec"; wait "$rec" 2>/dev/null || true; trap - EXIT

# Per-frame brightness and change, then the three flags.
ffmpeg -v error -i "$OUT/film.mp4" -vf "scale=196:-2,signalstats,metadata=print:file=$OUT/stats.txt" -f null -
ffmpeg -v error -i "$OUT/film.mp4" -vf "scale=196:-2,select='gt(scene,0.25)',metadata=print:file=$OUT/cuts.txt" -f null -
ffmpeg -v error -i "$OUT/film.mp4" -vf "freezedetect=n=0.001:d=1.5,metadata=print:file=$OUT/freeze.txt" -f null -
ffmpeg -v error -i "$OUT/film.mp4" -vf "fps=2,scale=262:-2,tile=10x1" "$OUT/frames/strip-%03d.jpg"
python3 - "$OUT" <<'PY'
import re, sys
out = sys.argv[1]
t, y = [], []
for line in open(f"{out}/stats.txt"):
    m = re.search(r"pts_time:([\d.]+)", line)
    if m: t.append(float(m.group(1)))
    m = re.search(r"lavfi.signalstats.YAVG=([\d.]+)", line)
    if m: y.append(float(m.group(1)))
flash = [(t[i], y[i-1], y[i], y[i+1]) for i in range(1, min(len(t), len(y)) - 1)
         if abs(y[i] - y[i-1]) > 40 and abs(y[i] - y[i+1]) > 40]
cuts = re.findall(r"pts_time:([\d.]+)", open(f"{out}/cuts.txt").read())
fr = re.findall(r"freeze_start=([\d.]+)|freeze_duration=([\d.]+)", open(f"{out}/freeze.txt").read())
starts = [float(a) for a, b in fr if a]; durs = [float(b) for a, b in fr if b]
with open(f"{out}/flags.txt", "w") as f:
    f.write(f"frames {len(t)}, length {t[-1] if t else 0:.1f} s\n")
    f.write(f"flash {len(flash)}\n" + "".join(f"  {a:7.2f}s  Y {b:.0f} -> {c:.0f} -> {d:.0f}\n" for a, b, c, d in flash))
    f.write(f"cut {len(cuts)}\n" + "".join(f"  {float(c):7.2f}s\n" for c in cuts))
    f.write(f"freeze {len(starts)}\n" + "".join(f"  {s:7.2f}s for {d:.1f} s\n" for s, d in zip(starts, durs)))
print(open(f"{out}/flags.txt").read())
PY
echo "video, steps.log, flags.txt and frames/ in $OUT"
