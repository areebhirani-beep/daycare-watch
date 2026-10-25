Endpoint test against `https://yqrrfawmsvhxgffgrmse.supabase.co`: 93 passed, 1 failed (2026-10-25 15:12 CDT)

| Endpoint | Input | Expected | Got | ms | Result |
|---|---|---|---|---|---|
| daycare_search | good | 200 | 200 | 872 | ok |
| daycare_search | zip | 200 | 200 | 339 | ok |
| daycare_search | typo | 200 | 200 | 3071 | ok |
| daycare_search | empty | 200 | 200 | 223 | ok |
| daycare_search | blank | 200 | 200 | 119 | ok |
| daycare_search | null | 200 | 200 | 253 | ok |
| daycare_search | missing-arg | 404 | 404 | 244 | ok |
| daycare_search | huge-20k | 200 | 200 | 231 | ok |
| daycare_search | unicode | 200 | 200 | 204 | ok |
| daycare_search | accent-off | 200 | 200 | 284 | ok |
| daycare_search | emoji | 200 | 200 | 1050 | ok |
| daycare_search | curly-quote | 200 | 200 | 129 | ok |
| daycare_search | sql-drop | 200 | 200 | 386 | ok |
| daycare_search | sql-or | 200 | 200 | 227 | ok |
| daycare_search | like-wild | 200 | 200 | 117 | ok |
| daycare_search | like-under | 200 | 200 | 353 | ok |
| daycare_search | backslash | 200 | 200 | 265 | ok |
| daycare_search | nul-byte | 400 | 400 | 136 | ok |
| daycare_search | bad-json | 400 | 400 | 117 | ok |
| daycare_search | get-form | 200 | 200 | 281 | ok |
| daycare_search | no-home-street | 200 | 200 | 359 | ok |
| daycares_near | good | 200 | 200 | 374 | ok |
| daycares_near | km-zero | 200 | 200 | 121 | ok |
| daycares_near | km-negative | 200 | 200 | 128 | ok |
| daycares_near | km-huge | 200 | 200 | 393 | ok |
| daycares_near | lat-91 | 200 | 200 | 129 | ok |
| daycares_near | lat-1e308 | 200 | 200 | 129 | ok |
| daycares_near | lat-text | 400 | 400 | 132 | ok |
| daycares_near | null-island | 200 | 200 | 199 | ok |
| daycares_near | filters-junk | 200 | 200 | 171 | ok |
| daycares_near | filters-text | 200 | 200 | 242 | ok |
| daycares_near | no-street-zip | 200 | 200 | 289 | ok |
| daycare_record | good | 200 | 200 | 150 | ok |
| daycare_record | photos-max-2 | 200 | 200 | 127 | ok |
| daycare_record | unknown-id | 200 | 200 | 252 | ok |
| daycare_record | null-id | 200 | 200 | 125 | ok |
| daycare_record | bigint-max | 200 | 200 | 124 | ok |
| daycare_record | overflow | 400 | 400 | 134 | ok |
| daycare_record | text-id | 400 | 400 | 122 | ok |
| area_compare | good | 200 | 200 | 163 | ok |
| area_compare | unknown-id | 200 | 200 | 134 | ok |
| area_compare | text-id | 400 | 400 | 161 | ok |
| district_pulse | default | 200 | 200 | 210 | ok |
| district_pulse | null | 200 | 200 | 320 | ok |
| district_pulse | far-future | 200 | 200 | 146 | ok |
| district_pulse | bad-date | 400 | 400 | 141 | ok |
| district_recent_visits | default | 200 | 500 | 3483 | FAIL (got 500: {"code":"57014","details":null,"hint":null,"message":"canceling statement due to statement timeout"}) |
| district_recent_visits | limit-0 | 200 | 200 | 1206 | ok |
| district_recent_visits | limit-neg | 200 | 200 | 1132 | ok |
| district_recent_visits | limit-huge | 200 | 200 | 311 | ok |
| district_recent_visits | no-home-name | 200 | 200 | 258 | ok |
| last_sync | good | 200 | 200 | 137 | ok |
| watch | anon | 401 | 401 | 135 | ok |
| unwatch | anon | 401 | 401 | 164 | ok |
| my_watches | anon | 401 | 401 | 167 | ok |
| alert_detail | anon | 401 | 401 | 157 | ok |
| register_device | anon | 401 | 401 | 147 | ok |
| watch | garbage-jwt | 401 | 401 | 118 | ok |
| watch | forged-jwt | 401 | 401 | 130 | ok |
| daycare_search | alg-none | 401 | 401 | 122 | ok |
| schema core | profile | 406 | 406 | 130 | ok |
| schema app | profile | 406 | 406 | 132 | ok |
| schema geo | profile | 406 | 406 | 167 | ok |
| schema ops | profile | 406 | 406 | 228 | ok |
| schema staging | profile | 406 | 406 | 150 | ok |
| schema auth | profile | 406 | 406 | 153 | ok |
| schema storage | profile | 406 | 406 | 259 | ok |
| schema vault | profile | 406 | 406 | 131 | ok |
| public table daycares | direct | 404 | 404 | 203 | ok |
| public table watches | direct | 404 | 404 | 121 | ok |
| public table devices | direct | 404 | 404 | 129 | ok |
| refresh_aggregates | internal | 404 | 404 | 115 | ok |
| core.today via rpc | internal | 404 | 404 | 132 | ok |
| write via POST table | direct | 404 | 404 | 233 | ok |
| auth admin users | admin | 401|403 | 403 | 189 | ok |
| storage buckets | storage | 200|400|401|403 | 200 | 293 | ok |
| watch | user A | 204 | 204 | 396 | ok |
| watch | user A again | 204 | 204 | 144 | ok |
| watch | unknown id | 404 | 404 | 124 | ok |
| watch | text id | 400 | 400 | 147 | ok |
| my_watches | user A | 200 | 200 | 155 | ok |
| my_watches | user B sees none | 200 | 200 | 249 | ok |
| unwatch | user B on A's | 204 | 204 | 132 | ok |
| my_watches | A kept after B | 200 | 200 | 120 | ok |
| alert_detail | unknown event | 200 | 200 | 122 | ok |
| alert_detail | text event | 400 | 400 | 173 | ok |
| register_device | not expo | 400 | 400 | 118 | ok |
| register_device | bad platform | 400 | 400 | 157 | ok |
| register_device | sql token | 400 | 400 | 143 | ok |
| register_device | huge token | 400 | 400 | 146 | ok |
| unwatch | user A | 204 | 204 | 125 | ok |
| my_watches | A empty | 200 | 200 | 164 | ok |
| app schema as user | profile | 406 | 406 | 113 | ok |
| daycare_search x50 parallel | load | 200 x50 | 50/50 | p95 1815 / max 1869 | ok |
