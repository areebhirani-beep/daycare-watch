#!/usr/bin/env bash
# Every public API path, hit the way a client (or an attacker) would: each RPC with good, empty, bad, huge,
# unicode and SQL-like input, signed out and signed in, cross-user RLS denials, tables and schemas that must
# stay unreachable, and 50 parallel calls. A case passes on the expected HTTP code plus an optional jq check;
# any 5xx fails. Uses only the public (publishable/anon) key; never pass the service-role key here.
#
#   Local: supabase/snippets/api_endpoints.sh
#   Cloud: SUPABASE_URL=https://<ref>.supabase.co ANON_KEY=<publishable key> supabase/snippets/api_endpoints.sh
#   OUT=<file.md> also writes the results as a markdown table.
#
# Leaves two anonymous auth users behind (no watches, no devices). register_device with a well-formed token
# runs only against the local stack, so no test token ever reaches the cloud push list.
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${ANON_KEY:-}" ]]; then
  status_json="$(supabase status -o json 2>/dev/null)"
  SUPABASE_URL="${SUPABASE_URL:-$(jq -r '.API_URL' <<<"$status_json")}"
  ANON_KEY="${ANON_KEY:-$(jq -r '.ANON_KEY' <<<"$status_json")}"
fi
local_stack=0
[[ "$SUPABASE_URL" == http://127.0.0.1:* || "$SUPABASE_URL" == http://localhost:* ]] && local_stack=1

pass=0
fail=0
rows=()
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

# t NAME INPUT_CLASS EXPECTED_CODES(a|b) METHOD PATH [BODY] [JWT] [EXTRA_HEADER] [JQ_CHECK]
t() {
  local name="$1" class="$2" want="$3" method="$4" path="$5" body="${6:-}" jwt="${7:-$ANON_KEY}" hdr="${8:-}" check="${9:-}"
  local extra=() out code ms verdict note=""
  [[ -n "$hdr" ]] && extra=(-H "$hdr")
  out="$(curl -sS -o "$body_file" -w '%{http_code} %{time_total}' -X "$method" "$SUPABASE_URL$path" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $jwt" -H 'Content-Type: application/json' \
    ${extra[@]+"${extra[@]}"} ${body:+--data-binary "$body"})"
  code="${out%% *}"
  ms="$(awk -v s="${out##* }" 'BEGIN { printf "%d", s * 1000 }')"
  verdict=ok
  if [[ "$code" == 5* || "|$want|" != *"|$code|"* ]]; then verdict=FAIL; note="got $code: $(head -c 120 "$body_file")"; fi
  if [[ "$verdict" == ok && -n "$check" ]] && ! jq -e "$check" "$body_file" >/dev/null 2>&1; then
    verdict=FAIL; note="check failed: $check; body $(head -c 120 "$body_file")"
  fi
  if [[ "$verdict" == ok ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); fi
  printf '  %-4s %-26s %-11s %s %5s ms %s\n' "$verdict" "$name" "$class" "$code" "$ms" "$note"
  rows+=("| $name | $class | $want | $code | $ms | $verdict${note:+ ($note)} |")
}
rpc() { echo "/rest/v1/rpc/$1"; }
long="$(printf 'a%.0s' $(seq 1 20000))"

echo "Endpoint test against $SUPABASE_URL"

echo "daycare_search"
t daycare_search good 200 POST "$(rpc daycare_search)" '{"q":"Rockwall"}' "" "" 'length > 0 and length <= 50'
t daycare_search zip 200 POST "$(rpc daycare_search)" '{"q":"75087"}' "" "" 'length > 0 and all(.[]; .zip | startswith("75087"))'
t daycare_search typo 200 POST "$(rpc daycare_search)" '{"q":"Lionhart"}' "" "" 'any(.[]; .name | test("Lionheart"; "i"))'
t daycare_search empty 200 POST "$(rpc daycare_search)" '{"q":""}' "" "" '. == []'
t daycare_search blank 200 POST "$(rpc daycare_search)" '{"q":"   "}' "" "" '. == []'
t daycare_search null 200 POST "$(rpc daycare_search)" '{"q":null}' "" "" '. == []'
t daycare_search missing-arg 404 POST "$(rpc daycare_search)" '{}'
t daycare_search huge-20k 200 POST "$(rpc daycare_search)" "{\"q\":\"$long\"}" "" "" 'length <= 50'
t daycare_search unicode 200 POST "$(rpc daycare_search)" '{"q":"Pequeños Exploradores"}' "" "" 'any(.[]; .name == "Los Pequeños Exploradores")'
t daycare_search accent-off 200 POST "$(rpc daycare_search)" '{"q":"Pequenos Exploradores"}' "" "" 'any(.[]; .name == "Los Pequeños Exploradores")'
t daycare_search emoji 200 POST "$(rpc daycare_search)" '{"q":"🚸🏫"}' "" "" 'type == "array"'
t daycare_search curly-quote 200 POST "$(rpc daycare_search)" '{"q":"Kid’s Quest"}' "" "" 'type == "array" and length > 0'
t daycare_search sql-drop 200 POST "$(rpc daycare_search)" "{\"q\":\"'; drop table core.daycares; --\"}" "" "" 'type == "array"'
t daycare_search sql-or 200 POST "$(rpc daycare_search)" "{\"q\":\"x' or '1'='1\"}" "" "" 'length <= 50'
t daycare_search like-wild 200 POST "$(rpc daycare_search)" '{"q":"%"}' "" "" '. == []'
t daycare_search like-under 200 POST "$(rpc daycare_search)" '{"q":"_____"}' "" "" '. == []'
t daycare_search backslash 200 POST "$(rpc daycare_search)" '{"q":"\\\\"}' "" "" 'type == "array"'
t daycare_search nul-byte 400 POST "$(rpc daycare_search)" '{"q":"\u0000x"}'
t daycare_search bad-json 400 POST "$(rpc daycare_search)" '{"q":'
t daycare_search get-form 200 GET "$(rpc daycare_search)?q=Plano" "" "" "" 'length > 0'
t daycare_search no-home-street 200 POST "$(rpc daycare_search)" '{"q":"Allen"}' "" "" 'all(.[]; .operation_type == "Licensed Center" or (.address == null and (.zip // "" | test("^[0-9]{5}$"))))'

echo "daycares_near"
t daycares_near good 200 POST "$(rpc daycares_near)" '{"lat":33.2,"lng":-96.7,"km":5}' "" "" 'length > 0'
t daycares_near km-zero 200 POST "$(rpc daycares_near)" '{"lat":33.2,"lng":-96.7,"km":0}' "" "" '. == []'
t daycares_near km-negative 200 POST "$(rpc daycares_near)" '{"lat":33.2,"lng":-96.7,"km":-5}' "" "" '. == []'
t daycares_near km-huge 200 POST "$(rpc daycares_near)" '{"lat":33.2,"lng":-96.7,"km":100000}' "" "" 'length <= 200'
t daycares_near lat-91 200 POST "$(rpc daycares_near)" '{"lat":91,"lng":-96.7,"km":5}' "" "" '. == []'
t daycares_near lat-1e308 200 POST "$(rpc daycares_near)" '{"lat":1e308,"lng":-96.7,"km":5}' "" "" '. == []'
t daycares_near lat-text 400 POST "$(rpc daycares_near)" '{"lat":"abc","lng":-96.7,"km":5}'
t daycares_near null-island 200 POST "$(rpc daycares_near)" '{"lat":0,"lng":0,"km":5}' "" "" '. == []'
t daycares_near filters-junk 200 POST "$(rpc daycares_near)" '{"lat":33.2,"lng":-96.7,"km":5,"filters":{"x":"; drop"}}' "" "" 'type == "array"'
t daycares_near filters-text 200 POST "$(rpc daycares_near)" '{"lat":33.2,"lng":-96.7,"km":5,"filters":"x"}' "" "" 'type == "array"'
t daycares_near home-rounded 200 POST "$(rpc daycares_near)" '{"lat":33.2,"lng":-96.7,"km":30}' "" "" 'all(.[]; .operation_type == "Licensed Center" or (.address == null and (.zip // "" | test("^[0-9]{5}$"))))'

echo "daycare_record / area_compare"
t daycare_record good 200 POST "$(rpc daycare_record)" '{"p_operation_id":1459611}' "" "" 'has("daycare") and has("findings") and has("inspections") and has("photos") and has("official_url")'
t daycare_record photos-max-2 200 POST "$(rpc daycare_record)" '{"p_operation_id":1459611}' "" "" '(.photos | length) <= 2'
t daycare_record unknown-id 200 POST "$(rpc daycare_record)" '{"p_operation_id":-1}' "" "" '. == null'
t daycare_record null-id 200 POST "$(rpc daycare_record)" '{"p_operation_id":null}' "" "" '. == null'
t daycare_record bigint-max 200 POST "$(rpc daycare_record)" '{"p_operation_id":9223372036854775807}' "" "" '. == null'
t daycare_record overflow 400 POST "$(rpc daycare_record)" '{"p_operation_id":99999999999999999999999}'
t daycare_record text-id 400 POST "$(rpc daycare_record)" '{"p_operation_id":"1 or 1=1"}'
t area_compare good 200 POST "$(rpc area_compare)" '{"p_operation_id":1459611}' "" "" 'type == "object"'
t area_compare unknown-id 200 POST "$(rpc area_compare)" '{"p_operation_id":-1}' "" "" '. == null'
t area_compare text-id 400 POST "$(rpc area_compare)" '{"p_operation_id":"x"}'

echo "district_pulse / district_recent_visits / last_sync"
t district_pulse default 200 POST "$(rpc district_pulse)" '{}' "" "" 'has("visits") and has("findings")'
t district_pulse null 200 POST "$(rpc district_pulse)" '{"week_start":null}' "" "" 'has("visits")'
t district_pulse far-future 200 POST "$(rpc district_pulse)" '{"week_start":"3000-01-01"}' "" "" '.visits == 0'
t district_pulse bad-date 400 POST "$(rpc district_pulse)" '{"week_start":"2026-13-40"}'
t district_recent_visits default 200 POST "$(rpc district_recent_visits)" '{}' "" "" 'type == "array"'
t district_recent_visits limit-0 200 POST "$(rpc district_recent_visits)" '{"p_limit":0}' "" "" 'type == "array"'
t district_recent_visits limit-neg 200 POST "$(rpc district_recent_visits)" '{"p_limit":-1}' "" "" 'type == "array"'
t district_recent_visits limit-huge 200 POST "$(rpc district_recent_visits)" '{"p_limit":1000000}' "" "" 'length <= 50'
t district_recent_visits no-home-name 200 POST "$(rpc district_recent_visits)" '{}' "" "" 'all(.[]; .operation_type == "Licensed Center" or .name == null)'
t last_sync good 200 POST "$(rpc last_sync)" '{}' "" "" '.ok == true and (.finished_at | length) > 0'

echo "Denied: signed-out writes and private reads"
t watch anon 401 POST "$(rpc watch)" '{"p_operation_id":1459611}'
t unwatch anon 401 POST "$(rpc unwatch)" '{"p_operation_id":1459611}'
t my_watches anon 401 POST "$(rpc my_watches)" '{}'
t alert_detail anon 401 POST "$(rpc alert_detail)" '{"p_event_id":1}'
t register_device anon 401 POST "$(rpc register_device)" '{"p_expo_push_token":"ExponentPushToken[qa]","p_platform":"ios"}'
t watch garbage-jwt 401 POST "$(rpc watch)" '{"p_operation_id":1459611}' 'not.a.jwt'
t watch forged-jwt 401 POST "$(rpc watch)" '{"p_operation_id":1459611}' 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwic3ViIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIn0.c2lnbmF0dXJl'
t daycare_search alg-none 401 POST "$(rpc daycare_search)" '{"q":"Plano"}' 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.'

echo "Denied: tables, schemas and internal functions"
for s in core app geo ops staging auth storage vault; do
  t "schema $s" profile 406 GET '/rest/v1/daycares?limit=1' "" "" "Accept-Profile: $s"
done
t "public table daycares" direct 404 GET '/rest/v1/daycares?limit=1'
t "public table watches" direct 404 GET '/rest/v1/watches?limit=1'
t "public table devices" direct 404 GET '/rest/v1/devices?limit=1'
t refresh_aggregates internal 404 POST "$(rpc refresh_aggregates)" '{}'
t "core.today via rpc" internal 404 POST "$(rpc today)" '{}'
t "write via POST table" direct 404 POST '/rest/v1/daycares' '{"operation_id":1}'
t "auth admin users" admin 401\|403 GET '/auth/v1/admin/users'
t "storage buckets" storage 200\|400\|401\|403 GET '/storage/v1/bucket' "" "" "" '(type == "array" and length == 0) or type == "object"'

echo "Signed in: own watches, cross-user RLS"
signup() { curl -sS -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' -d '{"data":{}}' | jq -r '.access_token // empty'; }
a="$(signup)"
b="$(signup)"
if [[ -z "$a" || -z "$b" ]]; then
  echo "  FAIL anonymous sign-in returned no token"; fail=$((fail + 1))
else
  t watch "user A" 204 POST "$(rpc watch)" '{"p_operation_id":1459611}' "$a"
  t watch "user A again" 204 POST "$(rpc watch)" '{"p_operation_id":1459611}' "$a"
  t watch "unknown id" 404 POST "$(rpc watch)" '{"p_operation_id":-1}' "$a"
  t watch "text id" 400 POST "$(rpc watch)" '{"p_operation_id":"x"}' "$a"
  t my_watches "user A" 200 POST "$(rpc my_watches)" '{}' "$a" "" '[.[] | select(.operation_id == 1459611)] | length == 1'
  t my_watches "user B sees none" 200 POST "$(rpc my_watches)" '{}' "$b" "" '. == []'
  t unwatch "user B on A's" 204 POST "$(rpc unwatch)" '{"p_operation_id":1459611}' "$b"
  t my_watches "A kept after B" 200 POST "$(rpc my_watches)" '{}' "$a" "" 'length == 1'
  t alert_detail "unknown event" 200 POST "$(rpc alert_detail)" '{"p_event_id":-1}' "$a" "" '. == null'
  t alert_detail "text event" 400 POST "$(rpc alert_detail)" '{"p_event_id":"x"}' "$a"
  t register_device "not expo" 400 POST "$(rpc register_device)" '{"p_expo_push_token":"not-a-token","p_platform":"ios"}' "$a"
  t register_device "bad platform" 400 POST "$(rpc register_device)" '{"p_expo_push_token":"ExponentPushToken[qa]","p_platform":"windows"}' "$a"
  t register_device "sql token" 400 POST "$(rpc register_device)" "{\"p_expo_push_token\":\"ExponentPushToken[x]'); delete from app.devices; --\",\"p_platform\":\"ios\"}" "$a"
  # Before 20261025130000 a huge token was stored, so only send it where that migration is in (watch(-1) is 404).
  if [[ "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$SUPABASE_URL$(rpc watch)" -H "apikey: $ANON_KEY" \
         -H "Authorization: Bearer $a" -H 'Content-Type: application/json' -d '{"p_operation_id":-1}')" == 404 ]]; then
    t register_device "huge token" 400 POST "$(rpc register_device)" "{\"p_expo_push_token\":\"ExponentPushToken[$long]\",\"p_platform\":\"ios\"}" "$a"
  else
    echo "  FAIL register_device huge token: not sent, this database lacks 20261025130000 and would store it"
    fail=$((fail + 1))
    rows+=("| register_device | huge token | 400 | not sent | | FAIL (migration 20261025130000 missing; it would be stored) |")
  fi
  if [[ "$local_stack" == 1 ]]; then
    t register_device "good (local)" 204 POST "$(rpc register_device)" '{"p_expo_push_token":"ExponentPushToken[qa-endpoint-test]","p_platform":"ios"}' "$a"
    t register_device "again (local)" 204 POST "$(rpc register_device)" '{"p_expo_push_token":"ExponentPushToken[qa-endpoint-test]","p_platform":"ios"}' "$a"
  fi
  t unwatch "user A" 204 POST "$(rpc unwatch)" '{"p_operation_id":1459611}' "$a"
  t my_watches "A empty" 200 POST "$(rpc my_watches)" '{}' "$a" "" '. == []'
  t "app schema as user" profile 406 GET '/rest/v1/watches?limit=1' "" "$a" 'Accept-Profile: app'
fi

echo "50 parallel calls (daycare_search, mixed queries)"
par="$(mktemp)"
for i in $(seq 1 50); do echo "Rockwall Plano McKinney Allen Frisco Sherman Lionhart 75087 Greenville Wylie" | tr ' ' '\n' | sed -n "$(( (i % 10) + 1 ))p"; done |
  xargs -P 50 -I{} curl -sS -o /dev/null -w '%{http_code} %{time_total}\n' -X POST "$SUPABASE_URL/rest/v1/rpc/daycare_search" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' -d '{"q":"{}"}' >"$par"
ok200="$(grep -c '^200 ' "$par" || true)"
p95="$(awk '{print $2 * 1000}' "$par" | sort -n | awk '{a[NR]=$1} END {printf "%d", a[int(NR * 0.95 + 0.5)]}')"
max="$(awk '{print $2 * 1000}' "$par" | sort -n | tail -1 | awk '{printf "%d", $1}')"
rm -f "$par"
if [[ "$ok200" == 50 ]]; then v=ok; pass=$((pass + 1)); else v=FAIL; fail=$((fail + 1)); fi
printf '  %-4s %-26s %-11s %s/50 200, p95 %s ms, max %s ms\n' "$v" "50 parallel" load "$ok200" "$p95" "$max"
rows+=("| daycare_search x50 parallel | load | 200 x50 | $ok200/50 | p95 $p95 / max $max | $v |")

echo "Result: $pass passed, $fail failed"
if [[ -n "${OUT:-}" ]]; then
  {
    echo "Endpoint test against \`$SUPABASE_URL\`: $pass passed, $fail failed ($(date '+%Y-%m-%d %H:%M %Z'))"
    echo
    echo "| Endpoint | Input | Expected | Got | ms | Result |"
    echo "|---|---|---|---|---|---|"
    printf '%s\n' "${rows[@]}"
  } >"$OUT"
fi
[[ "$fail" == 0 ]]
