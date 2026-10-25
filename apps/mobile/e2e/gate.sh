#!/usr/bin/env bash
# Design gate: every screen in light, dark, and the largest accessibility text size.
# Writes harness/state/screens/gate/<mode>-<screen>.png. EVENT_ID = a replay event this simulator watches.
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
EVENT_ID=${EVENT_ID:-49}
mkdir -p ../../harness/state/screens/gate

run() {
  local mode=$1 appearance=$2 size=$3
  xcrun simctl ui booted appearance "$appearance"
  xcrun simctl ui booted content_size "$size"
  maestro test -e MODE="$mode" -e EVENT_ID="$EVENT_ID" e2e/gate.yaml
}

run light light large
run dark dark large
run xxxl light accessibility-extra-extra-extra-large

xcrun simctl ui booted appearance light
xcrun simctl ui booted content_size large
echo "gate: $(ls ../../harness/state/screens/gate | wc -l | tr -d ' ') screenshots"
