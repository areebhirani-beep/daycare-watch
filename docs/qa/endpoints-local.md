Endpoint test against `http://127.0.0.1:55321`: 93 passed, 3 failed (2026-10-25 14:59 CDT)

| Endpoint | Input | Expected | Got | ms | Result |
|---|---|---|---|---|---|
| daycare_search | good | 200 | 200 | 1927 | ok |
| daycare_search | zip | 200 | 200 | 188 | ok |
| daycare_search | typo | 200 | 500 | 3206 | FAIL (got 500: {"code":"57014","details":null,"hint":null,"message":"canceling statement due to statement timeout"}) |
| daycare_search | empty | 200 | 200 | 134 | ok |
| daycare_search | blank | 200 | 200 | 65 | ok |
| daycare_search | null | 200 | 200 | 35 | ok |
| daycare_search | missing-arg | 404 | 404 | 66 | ok |
| daycare_search | huge-20k | 200 | 200 | 109 | ok |
| daycare_search | unicode | 200 | 200 | 189 | ok |
| daycare_search | accent-off | 200 | 200 | 67 | ok |
| daycare_search | emoji | 200 | 500 | 3292 | FAIL (got 500: {"code":"57014","details":null,"hint":null,"message":"canceling statement due to statement timeout"}) |
| daycare_search | curly-quote | 200 | 200 | 564 | ok |
| daycare_search | sql-drop | 200 | 200 | 1951 | ok |
| daycare_search | sql-or | 200 | 200 | 933 | ok |
| daycare_search | like-wild | 200 | 200 | 230 | ok |
| daycare_search | like-under | 200 | 200 | 781 | ok |
| daycare_search | backslash | 200 | 200 | 101 | ok |
| daycare_search | nul-byte | 400 | 400 | 33 | ok |
| daycare_search | bad-json | 400 | 400 | 30 | ok |
| daycare_search | get-form | 200 | 200 | 71 | ok |
| daycare_search | no-home-street | 200 | 200 | 91 | FAIL (check failed: all(.[]; has("address") or has("zip") | not); body [{"operation_id":1529274,"name":"[home daycare name removed]","operation_type":"Registered Child-Care Home","address":null,"city":"LAKE) |
| daycares_near | good | 200 | 200 | 99 | ok |
| daycares_near | km-zero | 200 | 200 | 26 | ok |
| daycares_near | km-negative | 200 | 200 | 19 | ok |
| daycares_near | km-huge | 200 | 200 | 111 | ok |
| daycares_near | lat-91 | 200 | 200 | 139 | ok |
| daycares_near | lat-1e308 | 200 | 200 | 131 | ok |
| daycares_near | lat-text | 400 | 400 | 147 | ok |
| daycares_near | null-island | 200 | 200 | 55 | ok |
| daycares_near | filters-junk | 200 | 200 | 141 | ok |
| daycares_near | filters-text | 200 | 200 | 98 | ok |
| daycares_near | no-street-zip | 200 | 200 | 59 | ok |
| daycare_record | good | 200 | 200 | 80 | ok |
| daycare_record | photos-max-2 | 200 | 200 | 63 | ok |
| daycare_record | unknown-id | 200 | 200 | 68 | ok |
| daycare_record | null-id | 200 | 200 | 33 | ok |
| daycare_record | bigint-max | 200 | 200 | 53 | ok |
| daycare_record | overflow | 400 | 400 | 31 | ok |
| daycare_record | text-id | 400 | 400 | 51 | ok |
| area_compare | good | 200 | 200 | 61 | ok |
| area_compare | unknown-id | 200 | 200 | 97 | ok |
| area_compare | text-id | 400 | 400 | 74 | ok |
| district_pulse | default | 200 | 200 | 24 | ok |
| district_pulse | null | 200 | 200 | 23 | ok |
| district_pulse | far-future | 200 | 200 | 24 | ok |
| district_pulse | bad-date | 400 | 400 | 26 | ok |
| district_recent_visits | default | 200 | 200 | 950 | ok |
| district_recent_visits | limit-0 | 200 | 200 | 115 | ok |
| district_recent_visits | limit-neg | 200 | 200 | 109 | ok |
| district_recent_visits | limit-huge | 200 | 200 | 178 | ok |
| district_recent_visits | no-home-name | 200 | 200 | 141 | ok |
| last_sync | good | 200 | 200 | 35 | ok |
| watch | anon | 401 | 401 | 54 | ok |
| unwatch | anon | 401 | 401 | 65 | ok |
| my_watches | anon | 401 | 401 | 36 | ok |
| alert_detail | anon | 401 | 401 | 51 | ok |
| register_device | anon | 401 | 401 | 213 | ok |
| watch | garbage-jwt | 401 | 401 | 179 | ok |
| watch | forged-jwt | 401 | 401 | 97 | ok |
| daycare_search | alg-none | 401 | 401 | 77 | ok |
| schema core | profile | 406 | 406 | 101 | ok |
| schema app | profile | 406 | 406 | 173 | ok |
| schema geo | profile | 406 | 406 | 159 | ok |
| schema ops | profile | 406 | 406 | 27 | ok |
| schema staging | profile | 406 | 406 | 72 | ok |
| schema auth | profile | 406 | 406 | 104 | ok |
| schema storage | profile | 406 | 406 | 40 | ok |
| schema vault | profile | 406 | 406 | 45 | ok |
| public table daycares | direct | 404 | 404 | 92 | ok |
| public table watches | direct | 404 | 404 | 64 | ok |
| public table devices | direct | 404 | 404 | 18 | ok |
| refresh_aggregates | internal | 404 | 404 | 35 | ok |
| core.today via rpc | internal | 404 | 404 | 24 | ok |
| write via POST table | direct | 404 | 404 | 27 | ok |
| auth admin users | admin | 401|403 | 403 | 90 | ok |
| storage buckets | storage | 200|400|401|403 | 200 | 427 | ok |
| watch | user A | 204 | 204 | 51 | ok |
| watch | user A again | 204 | 204 | 30 | ok |
| watch | unknown id | 404 | 404 | 15 | ok |
| watch | text id | 400 | 400 | 18 | ok |
| my_watches | user A | 200 | 200 | 227 | ok |
| my_watches | user B sees none | 200 | 200 | 96 | ok |
| unwatch | user B on A's | 204 | 204 | 45 | ok |
| my_watches | A kept after B | 200 | 200 | 42 | ok |
| alert_detail | unknown event | 200 | 200 | 62 | ok |
| alert_detail | text event | 400 | 400 | 26 | ok |
| register_device | not expo | 400 | 400 | 35 | ok |
| register_device | bad platform | 400 | 400 | 24 | ok |
| register_device | sql token | 400 | 400 | 20 | ok |
| register_device | huge token | 400 | 400 | 33 | ok |
| register_device | good (local) | 204 | 204 | 28 | ok |
| register_device | again (local) | 204 | 204 | 27 | ok |
| unwatch | user A | 204 | 204 | 29 | ok |
| my_watches | A empty | 200 | 200 | 25 | ok |
| app schema as user | profile | 406 | 406 | 15 | ok |
| daycare_search x50 parallel | load | 200 x50 | 50/50 | p95 757 / max 834 | ok |
