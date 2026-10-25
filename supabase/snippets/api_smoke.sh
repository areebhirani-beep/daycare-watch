#!/usr/bin/env bash
# End-to-end API smoke test through PostgREST + GoTrue, the same path the app uses.
# Uses only the public (publishable/anon) key; never pass the service-role key here.
#
#   Local: supabase/snippets/api_smoke.sh
#   Cloud: SUPABASE_URL=https://<ref>.supabase.co ANON_KEY=<publishable key> supabase/snippets/api_smoke.sh
#
# Leaves one anonymous auth user behind (with no watches and no devices).
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${ANON_KEY:-}" ]]; then
  status_json="$(supabase status -o json 2>/dev/null)"
  SUPABASE_URL="${SUPABASE_URL:-$(jq -r '.API_URL' <<<"$status_json")}"
  ANON_KEY="${ANON_KEY:-$(jq -r '.ANON_KEY' <<<"$status_json")}"
fi

pass=0
fail=0
ok() { echo "  ok   $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL $1"; fail=$((fail + 1)); }
expect_code() { # name expected actual
  if [[ "$3" == "$2" ]]; then ok "$1 ($3)"; else bad "$1 (wanted $2, got $3)"; fi
}

# call METHOD PATH [BODY] [JWT] [extra header] -> prints "<http code>\n<body>"
call() {
  local jwt="${4:-$ANON_KEY}"
  local extra=()
  [[ -n "${5:-}" ]] && extra=(-H "$5")
  curl -sS -o /dev/stdout -w '\n%{http_code}' -X "$1" "$SUPABASE_URL$2" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $jwt" \
    -H 'Content-Type: application/json' ${extra[@]+"${extra[@]}"} \
    ${3:+--data "$3"}
}
code_of() { tail -n1 <<<"$1"; }
body_of() { sed '$d' <<<"$1"; }

echo "API smoke test against $SUPABASE_URL"

echo "Public reads (anon key, no user)"
r="$(call POST /rest/v1/rpc/daycare_search '{"q":"Rockwall"}')"
expect_code "daycare_search" 200 "$(code_of "$r")"
op="$(body_of "$r" | jq -r '.[0].operation_id // empty')"
n="$(body_of "$r" | jq 'length')"
if [[ -n "$op" ]]; then ok "daycare_search returned $n rows (first operation_id $op)"; else bad "daycare_search returned no rows (is the backfill loaded?)"; fi

r="$(call POST /rest/v1/rpc/daycares_near '{"lat":32.93,"lng":-96.46,"km":10}')"
expect_code "daycares_near" 200 "$(code_of "$r")"
echo "       daycares_near returned $(body_of "$r" | jq 'length') rows"

if [[ -n "$op" ]]; then
  r="$(call POST /rest/v1/rpc/daycare_record "{\"p_operation_id\":$op}")"
  expect_code "daycare_record" 200 "$(code_of "$r")"
  if body_of "$r" | jq -e 'has("daycare") and has("findings") and has("inspections") and has("official_url")' >/dev/null; then
    ok "daycare_record shape"
  else bad "daycare_record shape"; fi
  r="$(call POST /rest/v1/rpc/area_compare "{\"p_operation_id\":$op}")"
  expect_code "area_compare" 200 "$(code_of "$r")"
fi
expect_code "district_pulse" 200 "$(code_of "$(call POST /rest/v1/rpc/district_pulse '{}')")"
expect_code "last_sync" 200 "$(code_of "$(call POST /rest/v1/rpc/last_sync '{}')")"

echo "Denied: no direct table access"
expect_code "core schema not exposed" 406 "$(code_of "$(call GET '/rest/v1/daycares?limit=1' '' '' 'Accept-Profile: core')")"
expect_code "app schema not exposed" 406 "$(code_of "$(call GET '/rest/v1/watches?limit=1' '' '' 'Accept-Profile: app')")"
expect_code "ops schema not exposed" 406 "$(code_of "$(call GET '/rest/v1/sync_runs?limit=1' '' '' 'Accept-Profile: ops')")"
r="$(call POST /rest/v1/rpc/refresh_aggregates '{}')"
expect_code "internal refresh_aggregates not callable" 404 "$(code_of "$r")"

echo "Denied: watch without a signed-in user"
if [[ -n "$op" ]]; then
  r="$(call POST /rest/v1/rpc/watch "{\"p_operation_id\":$op}")"
  c="$(code_of "$r")"
  if [[ "$c" == 401 || "$c" == 403 ]]; then ok "watch as anon key only ($c)"; else bad "watch as anon key only (wanted 401/403, got $c)"; fi
fi

echo "Anonymous sign-in + own watches"
r="$(call POST /auth/v1/signup '{"data":{}}')"
expect_code "anonymous sign-in" 200 "$(code_of "$r")"
jwt="$(body_of "$r" | jq -r '.access_token // empty')"
if [[ -n "$jwt" && -n "$op" ]]; then
  expect_code "watch" 204 "$(code_of "$(call POST /rest/v1/rpc/watch "{\"p_operation_id\":$op}" "$jwt")")"
  expect_code "watch again (idempotent)" 204 "$(code_of "$(call POST /rest/v1/rpc/watch "{\"p_operation_id\":$op}" "$jwt")")"
  r="$(call POST /rest/v1/rpc/my_watches '{}' "$jwt")"
  if [[ "$(body_of "$r" | jq "[.[] | select(.operation_id == $op)] | length")" == 1 ]]; then ok "my_watches has $op"; else bad "my_watches missing $op"; fi
  expect_code "unwatch" 204 "$(code_of "$(call POST /rest/v1/rpc/unwatch "{\"p_operation_id\":$op}" "$jwt")")"
  r="$(call POST /rest/v1/rpc/my_watches '{}' "$jwt")"
  if [[ "$(body_of "$r" | jq 'length')" == 0 ]]; then ok "my_watches empty after unwatch"; else bad "my_watches not empty after unwatch"; fi
  r="$(call POST /rest/v1/rpc/alert_detail '{"p_event_id":1}' "$jwt")"
  if [[ "$(body_of "$r")" == "null" || "$(code_of "$r")" != 200 ]]; then ok "alert_detail hidden for unwatched daycare"; else bad "alert_detail leaked an event"; fi
  r="$(call POST /rest/v1/rpc/register_device '{"p_expo_push_token":"not-a-token","p_platform":"ios"}' "$jwt")"
  expect_code "register_device rejects a non-Expo token" 400 "$(code_of "$r")"
else
  bad "no access token (is anonymous sign-in enabled? supabase config push)"
fi

# Optional: EVENT_ID + EVENT_OP = a real change event and its daycare (e.g. replay event 43 on 1304920).
if [[ -n "${EVENT_ID:-}" && -n "${EVENT_OP:-}" && -n "${jwt:-}" ]]; then
  echo "Alerts follow the watch (event $EVENT_ID on $EVENT_OP)"
  ev="{\"p_event_id\":$EVENT_ID}"
  r="$(call POST /rest/v1/rpc/alert_detail "$ev" "$jwt")"
  if [[ "$(body_of "$r")" == "null" ]]; then ok "alert_detail hidden before watching"; else bad "alert_detail visible before watching"; fi
  call POST /rest/v1/rpc/watch "{\"p_operation_id\":$EVENT_OP}" "$jwt" >/dev/null
  r="$(call POST /rest/v1/rpc/alert_detail "$ev" "$jwt")"
  if body_of "$r" | jq -e ".event_id == $EVENT_ID and .operation_id == $EVENT_OP" >/dev/null; then
    ok "alert_detail shown while watching (is_replay=$(body_of "$r" | jq -r .is_replay))"
  else bad "alert_detail missing while watching"; fi
  call POST /rest/v1/rpc/unwatch "{\"p_operation_id\":$EVENT_OP}" "$jwt" >/dev/null
  r="$(call POST /rest/v1/rpc/alert_detail "$ev" "$jwt")"
  if [[ "$(body_of "$r")" == "null" ]]; then ok "alert_detail hidden after unwatch"; else bad "alert_detail still visible after unwatch"; fi
fi

echo "Result: $pass passed, $fail failed"
[[ "$fail" == 0 ]]
