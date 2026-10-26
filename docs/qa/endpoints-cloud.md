Endpoint test against `https://yqrrfawmsvhxgffgrmse.supabase.co`: 94 passed, 0 failed (2026-10-26 03:30 CDT)

| Endpoint | Input | Expected | Got | ms | Result |
|---|---|---|---|---|---|
| daycare_search | good | 200 | 200 | 638 | ok |
| daycare_search | zip | 200 | 200 | 294 | ok |
| daycare_search | typo | 200 | 200 | 1231 | ok |
| daycare_search | empty | 200 | 200 | 329 | ok |
| daycare_search | blank | 200 | 200 | 343 | ok |
| daycare_search | null | 200 | 200 | 481 | ok |
| daycare_search | missing-arg | 404 | 404 | 132 | ok |
| daycare_search | huge-20k | 200 | 200 | 245 | ok |
| daycare_search | unicode | 200 | 200 | 265 | ok |
| daycare_search | accent-off | 200 | 200 | 230 | ok |
| daycare_search | emoji | 200 | 200 | 723 | ok |
| daycare_search | curly-quote | 200 | 200 | 135 | ok |
| daycare_search | sql-drop | 200 | 200 | 295 | ok |
| daycare_search | sql-or | 200 | 200 | 226 | ok |
| daycare_search | like-wild | 200 | 200 | 122 | ok |
| daycare_search | like-under | 200 | 200 | 377 | ok |
| daycare_search | backslash | 200 | 200 | 267 | ok |
| daycare_search | nul-byte | 400 | 400 | 127 | ok |
| daycare_search | bad-json | 400 | 400 | 122 | ok |
| daycare_search | get-form | 200 | 200 | 228 | ok |
| daycare_search | no-home-street | 200 | 200 | 307 | ok |
| daycares_near | good | 200 | 200 | 450 | ok |
| daycares_near | km-zero | 200 | 200 | 233 | ok |
| daycares_near | km-negative | 200 | 200 | 121 | ok |
| daycares_near | km-huge | 200 | 200 | 428 | ok |
| daycares_near | lat-91 | 200 | 200 | 130 | ok |
| daycares_near | lat-1e308 | 200 | 200 | 227 | ok |
| daycares_near | lat-text | 400 | 400 | 129 | ok |
| daycares_near | null-island | 200 | 200 | 167 | ok |
| daycares_near | filters-junk | 200 | 200 | 196 | ok |
| daycares_near | filters-text | 200 | 200 | 144 | ok |
| daycares_near | no-street-zip | 200 | 200 | 183 | ok |
| daycare_record | good | 200 | 200 | 167 | ok |
| daycare_record | photos-max-2 | 200 | 200 | 126 | ok |
| daycare_record | unknown-id | 200 | 200 | 121 | ok |
| daycare_record | null-id | 200 | 200 | 127 | ok |
| daycare_record | bigint-max | 200 | 200 | 117 | ok |
| daycare_record | overflow | 400 | 400 | 117 | ok |
| daycare_record | text-id | 400 | 400 | 123 | ok |
| area_compare | good | 200 | 200 | 140 | ok |
| area_compare | unknown-id | 200 | 200 | 115 | ok |
| area_compare | text-id | 400 | 400 | 118 | ok |
| district_pulse | default | 200 | 200 | 119 | ok |
| district_pulse | null | 200 | 200 | 135 | ok |
| district_pulse | far-future | 200 | 200 | 151 | ok |
| district_pulse | bad-date | 400 | 400 | 206 | ok |
| district_recent_visits | default | 200 | 200 | 1743 | ok |
| district_recent_visits | limit-0 | 200 | 200 | 256 | ok |
| district_recent_visits | limit-neg | 200 | 200 | 315 | ok |
| district_recent_visits | limit-huge | 200 | 200 | 279 | ok |
| district_recent_visits | no-home-name | 200 | 200 | 241 | ok |
| last_sync | good | 200 | 200 | 263 | ok |
| watch | anon | 401 | 401 | 280 | ok |
| unwatch | anon | 401 | 401 | 473 | ok |
| my_watches | anon | 401 | 401 | 120 | ok |
| alert_detail | anon | 401 | 401 | 128 | ok |
| register_device | anon | 401 | 401 | 234 | ok |
| watch | garbage-jwt | 401 | 401 | 124 | ok |
| watch | forged-jwt | 401 | 401 | 121 | ok |
| daycare_search | alg-none | 401 | 401 | 153 | ok |
| schema core | profile | 406 | 406 | 487 | ok |
| schema app | profile | 406 | 406 | 683 | ok |
| schema geo | profile | 406 | 406 | 226 | ok |
| schema ops | profile | 406 | 406 | 203 | ok |
| schema staging | profile | 406 | 406 | 113 | ok |
| schema auth | profile | 406 | 406 | 128 | ok |
| schema storage | profile | 406 | 406 | 146 | ok |
| schema vault | profile | 406 | 406 | 116 | ok |
| public table daycares | direct | 404 | 404 | 118 | ok |
| public table watches | direct | 404 | 404 | 112 | ok |
| public table devices | direct | 404 | 404 | 108 | ok |
| refresh_aggregates | internal | 404 | 404 | 125 | ok |
| core.today via rpc | internal | 404 | 404 | 113 | ok |
| write via POST table | direct | 404 | 404 | 114 | ok |
| auth admin users | admin | 401|403 | 403 | 193 | ok |
| storage buckets | storage | 200|400|401|403 | 200 | 448 | ok |
| watch | user A | 204 | 204 | 202 | ok |
| watch | user A again | 204 | 204 | 205 | ok |
| watch | unknown id | 404 | 404 | 120 | ok |
| watch | text id | 400 | 400 | 128 | ok |
| my_watches | user A | 200 | 200 | 167 | ok |
| my_watches | user B sees none | 200 | 200 | 146 | ok |
| unwatch | user B on A's | 204 | 204 | 123 | ok |
| my_watches | A kept after B | 200 | 200 | 134 | ok |
| alert_detail | unknown event | 200 | 200 | 136 | ok |
| alert_detail | text event | 400 | 400 | 135 | ok |
| register_device | not expo | 400 | 400 | 236 | ok |
| register_device | bad platform | 400 | 400 | 114 | ok |
| register_device | sql token | 400 | 400 | 190 | ok |
| register_device | huge token | 400 | 400 | 155 | ok |
| unwatch | user A | 204 | 204 | 129 | ok |
| my_watches | A empty | 200 | 200 | 157 | ok |
| app schema as user | profile | 406 | 406 | 115 | ok |
| daycare_search x50 parallel | load | 200 x50 | 50/50 | p95 940 / max 1022 | ok |
