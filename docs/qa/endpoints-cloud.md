Endpoint test against `https://yqrrfawmsvhxgffgrmse.supabase.co`: 92 passed, 2 failed (2026-10-25 12:36 CDT)

| Endpoint | Input | Expected | Got | ms | Result |
|---|---|---|---|---|---|
| daycare_search | good | 200 | 200 | 670 | ok |
| daycare_search | zip | 200 | 200 | 237 | ok |
| daycare_search | typo | 200 | 200 | 2621 | ok |
| daycare_search | empty | 200 | 200 | 359 | ok |
| daycare_search | blank | 200 | 200 | 187 | ok |
| daycare_search | null | 200 | 200 | 190 | ok |
| daycare_search | missing-arg | 404 | 404 | 124 | ok |
| daycare_search | huge-20k | 200 | 200 | 369 | ok |
| daycare_search | unicode | 200 | 200 | 250 | ok |
| daycare_search | accent-off | 200 | 200 | 225 | ok |
| daycare_search | emoji | 200 | 200 | 993 | ok |
| daycare_search | curly-quote | 200 | 200 | 262 | ok |
| daycare_search | sql-drop | 200 | 200 | 387 | ok |
| daycare_search | sql-or | 200 | 200 | 310 | ok |
| daycare_search | like-wild | 200 | 200 | 210 | ok |
| daycare_search | like-under | 200 | 200 | 403 | ok |
| daycare_search | backslash | 200 | 200 | 390 | ok |
| daycare_search | nul-byte | 400 | 400 | 192 | ok |
| daycare_search | bad-json | 400 | 400 | 117 | ok |
| daycare_search | get-form | 200 | 200 | 323 | ok |
| daycare_search | no-home-street | 200 | 200 | 294 | ok |
| daycares_near | good | 200 | 200 | 436 | ok |
| daycares_near | km-zero | 200 | 200 | 127 | ok |
| daycares_near | km-negative | 200 | 200 | 137 | ok |
| daycares_near | km-huge | 200 | 200 | 623 | ok |
| daycares_near | lat-91 | 200 | 200 | 124 | ok |
| daycares_near | lat-1e308 | 200 | 200 | 129 | ok |
| daycares_near | lat-text | 400 | 400 | 123 | ok |
| daycares_near | null-island | 200 | 200 | 133 | ok |
| daycares_near | filters-junk | 200 | 200 | 367 | ok |
| daycares_near | filters-text | 200 | 200 | 284 | ok |
| daycares_near | home-rounded | 200 | 200 | 229 | ok |
| daycare_record | good | 200 | 200 | 145 | ok |
| daycare_record | photos-max-2 | 200 | 200 | 149 | ok |
| daycare_record | unknown-id | 200 | 200 | 195 | ok |
| daycare_record | null-id | 200 | 200 | 119 | ok |
| daycare_record | bigint-max | 200 | 200 | 235 | ok |
| daycare_record | overflow | 400 | 400 | 239 | ok |
| daycare_record | text-id | 400 | 400 | 126 | ok |
| area_compare | good | 200 | 200 | 231 | ok |
| area_compare | unknown-id | 200 | 200 | 213 | ok |
| area_compare | text-id | 400 | 400 | 120 | ok |
| district_pulse | default | 200 | 200 | 143 | ok |
| district_pulse | null | 200 | 200 | 387 | ok |
| district_pulse | far-future | 200 | 200 | 142 | ok |
| district_pulse | bad-date | 400 | 400 | 118 | ok |
| district_recent_visits | default | 200 | 200 | 2683 | ok |
| district_recent_visits | limit-0 | 200 | 200 | 819 | ok |
| district_recent_visits | limit-neg | 200 | 200 | 309 | ok |
| district_recent_visits | limit-huge | 200 | 200 | 393 | ok |
| district_recent_visits | no-home-name | 200 | 200 | 362 | ok |
| last_sync | good | 200 | 200 | 239 | ok |
| watch | anon | 401 | 401 | 166 | ok |
| unwatch | anon | 401 | 401 | 230 | ok |
| my_watches | anon | 401 | 401 | 148 | ok |
| alert_detail | anon | 401 | 401 | 118 | ok |
| register_device | anon | 401 | 401 | 122 | ok |
| watch | garbage-jwt | 401 | 401 | 123 | ok |
| watch | forged-jwt | 401 | 401 | 123 | ok |
| daycare_search | alg-none | 401 | 401 | 162 | ok |
| schema core | profile | 406 | 406 | 242 | ok |
| schema app | profile | 406 | 406 | 168 | ok |
| schema geo | profile | 406 | 406 | 226 | ok |
| schema ops | profile | 406 | 406 | 143 | ok |
| schema staging | profile | 406 | 406 | 193 | ok |
| schema auth | profile | 406 | 406 | 122 | ok |
| schema storage | profile | 406 | 406 | 115 | ok |
| schema vault | profile | 406 | 406 | 118 | ok |
| public table daycares | direct | 404 | 404 | 135 | ok |
| public table watches | direct | 404 | 404 | 129 | ok |
| public table devices | direct | 404 | 404 | 135 | ok |
| refresh_aggregates | internal | 404 | 404 | 137 | ok |
| core.today via rpc | internal | 404 | 404 | 122 | ok |
| write via POST table | direct | 404 | 404 | 117 | ok |
| auth admin users | admin | 401|403 | 403 | 247 | ok |
| storage buckets | storage | 200|400|401|403 | 200 | 323 | ok |
| watch | user A | 204 | 204 | 302 | ok |
| watch | user A again | 204 | 204 | 148 | ok |
| watch | unknown id | 404 | 500 | 132 | FAIL (got 500: {"code":"P0002","details":null,"hint":null,"message":"unknown operation_id -1"}) |
| watch | text id | 400 | 400 | 130 | ok |
| my_watches | user A | 200 | 200 | 135 | ok |
| my_watches | user B sees none | 200 | 200 | 155 | ok |
| unwatch | user B on A's | 204 | 204 | 156 | ok |
| my_watches | A kept after B | 200 | 200 | 130 | ok |
| alert_detail | unknown event | 200 | 200 | 142 | ok |
| alert_detail | text event | 400 | 400 | 123 | ok |
| register_device | not expo | 400 | 400 | 126 | ok |
| register_device | bad platform | 400 | 400 | 129 | ok |
| register_device | sql token | 400 | 400 | 126 | ok |
| register_device | huge token | 400 | not sent | | FAIL (migration 20261025130000 missing; it would be stored) |
| unwatch | user A | 204 | 204 | 124 | ok |
| my_watches | A empty | 200 | 200 | 108 | ok |
| app schema as user | profile | 406 | 406 | 117 | ok |
| daycare_search x50 parallel | load | 200 x50 | 50/50 | p95 1106 / max 1139 | ok |
