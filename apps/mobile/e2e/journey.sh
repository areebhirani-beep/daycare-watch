#!/usr/bin/env bash
# Parent journey on the iOS simulator: find -> record -> watch -> alert.
# The alert is pipeline's replay of real state findings at Viva World School (op 1459611; run its --replay-latest first),
# delivered with simctl because the simulator has no Expo push token. PAYLOAD_ONLY=1 prints the push and stops.
# Needs: local Supabase stack, Metro (npx expo start --dev-client), the dev build on a booted simulator
# (or the Release build, no Metro). With several simulators booted, set DEVICE=<udid>.
set -euo pipefail
# Maestro resolves screenshot paths from the working directory, so run from apps/mobile.
cd "$(dirname "$0")/.."

export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
BUNDLE=com.areebhirani.daycare-watch
# With several simulators booted, Maestro and simctl each pick one on their own; DEVICE=<udid> pins both to the same one.
DEVICE=${DEVICE:-booted}
maestro() { if [ "$DEVICE" = booted ]; then command maestro "$@"; else command maestro --device "$DEVICE" "$@"; fi; }
OP=1459611
# Event ids change whenever pipeline replays, so take the newest one for Viva World School from the local database.
EVENT_ID=${EVENT_ID:-$(docker exec supabase_db_daycare-watch psql -U postgres -d postgres -At \
  -c "select id from core.change_events where operation_id = $OP order by id desc limit 1")}
[ -n "$EVENT_ID" ] || { echo "no replayed event for $OP: run pipeline's --replay-latest first" >&2; exit 1; }

# The banner text comes from pipeline's own message builder, so it is exactly what a phone would get.
# It groups the replayed findings of one visit into one push, as pipeline's notify does.
psql() { docker exec supabase_db_daycare-watch psql -U postgres -d postgres -At -c "$1"; }
event=$(psql "select row_to_json(t) from (select e.operation_id, e.kind::text as kind, e.is_replay, e.source_date, e.before, e.after,
  (e.after ->> 'activity_id')::bigint as activity_id, d.name from core.change_events e join core.daycares d using (operation_id)
  where e.id = $EVENT_ID) t")
# One replay call stamps all its events with one detected_at, the same batch notify sends; older replays of the visit stay out.
ids=$(psql "select json_agg(id order by id) from core.change_events where operation_id = $OP and is_replay
  and after ->> 'activity_id' = (select after ->> 'activity_id' from core.change_events where id = $EVENT_ID)
  and detected_at = (select detected_at from core.change_events where id = $EVENT_ID)")
payload=${PAYLOAD:-$(mktemp -t journey).apns}
(cd ../../services/pipeline && uv run python -c '
import datetime, json, sys
from pipeline.notify import Group
e, ids, bundle, out = json.loads(sys.argv[1]), json.loads(sys.argv[2]), sys.argv[3], sys.argv[4]
day = datetime.date.fromisoformat(e["source_date"]) if e["source_date"] else None
m = Group(None, e["operation_id"], e["kind"], e["name"], ids, e["is_replay"], day, e["before"], e["after"],
          e["activity_id"], ["simulator"]).messages()[0]
json.dump({"Simulator Target Bundle": bundle, "aps": {"alert": {"title": m["title"], "body": m["body"]}, "sound": "default"},
           "body": m["data"]}, open(out, "w"))
' "$event" "$ids" "$BUNDLE" "$payload")
[ "${PAYLOAD_ONLY:-}" = 1 ] && { cat "$payload"; echo; exit 0; }

maestro test e2e/journey-find-watch.yaml
# Fire the push once Maestro is up, so it taps the live banner (Notification Center taps don't open the app in the iOS 26 simulator).
(sleep 12 && xcrun simctl push "$DEVICE" "$BUNDLE" "$payload" && rm -f "$payload") &
maestro test e2e/alert-tap.yaml
wait
echo "journey: find -> record -> watch -> alert COMPLETED"
