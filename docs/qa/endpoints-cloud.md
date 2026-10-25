Endpoint test against `https://yqrrfawmsvhxgffgrmse.supabase.co`: 94 passed, 0 failed (2026-10-25 13:44 CDT)

| Endpoint | Input | Expected | Got | ms | Result |
|---|---|---|---|---|---|
| daycare_search | good | 200 | 200 | 153 | ok |
| daycare_search | zip | 200 | 200 | 222 | ok |
| daycare_search | typo | 200 | 200 | 2306 | ok |
| daycare_search | empty | 200 | 200 | 244 | ok |
| daycare_search | blank | 200 | 200 | 132 | ok |
| daycare_search | null | 200 | 200 | 246 | ok |
| daycare_search | missing-arg | 404 | 404 | 274 | ok |
| daycare_search | huge-20k | 200 | 200 | 246 | ok |
| daycare_search | unicode | 200 | 200 | 191 | ok |
| daycare_search | accent-off | 200 | 200 | 121 | ok |
| daycare_search | emoji | 200 | 200 | 791 | ok |
| daycare_search | curly-quote | 200 | 200 | 138 | ok |
| daycare_search | sql-drop | 200 | 200 | 270 | ok |
| daycare_search | sql-or | 200 | 200 | 233 | ok |
| daycare_search | like-wild | 200 | 200 | 313 | ok |
| daycare_search | like-under | 200 | 200 | 1055 | ok |
| daycare_search | backslash | 200 | 200 | 807 | ok |
| daycare_search | nul-byte | 400 | 400 | 806 | ok |
| daycare_search | bad-json | 400 | 400 | 244 | ok |
| daycare_search | get-form | 200 | 200 | 233 | ok |
| daycare_search | no-home-street | 200 | 200 | 229 | ok |
| daycares_near | good | 200 | 200 | 352 | ok |
| daycares_near | km-zero | 200 | 200 | 135 | ok |
| daycares_near | km-negative | 200 | 200 | 114 | ok |
| daycares_near | km-huge | 200 | 200 | 425 | ok |
| daycares_near | lat-91 | 200 | 200 | 141 | ok |
| daycares_near | lat-1e308 | 200 | 200 | 238 | ok |
| daycares_near | lat-text | 400 | 400 | 118 | ok |
| daycares_near | null-island | 200 | 200 | 143 | ok |
| daycares_near | filters-junk | 200 | 200 | 154 | ok |
| daycares_near | filters-text | 200 | 200 | 135 | ok |
| daycares_near | home-rounded | 200 | 200 | 217 | ok |
| daycare_record | good | 200 | 200 | 153 | ok |
| daycare_record | photos-max-2 | 200 | 200 | 125 | ok |
| daycare_record | unknown-id | 200 | 200 | 128 | ok |
| daycare_record | null-id | 200 | 200 | 135 | ok |
| daycare_record | bigint-max | 200 | 200 | 121 | ok |
| daycare_record | overflow | 400 | 400 | 115 | ok |
| daycare_record | text-id | 400 | 400 | 130 | ok |
| area_compare | good | 200 | 200 | 160 | ok |
| area_compare | unknown-id | 200 | 200 | 151 | ok |
| area_compare | text-id | 400 | 400 | 157 | ok |
| district_pulse | default | 200 | 200 | 147 | ok |
| district_pulse | null | 200 | 200 | 207 | ok |
| district_pulse | far-future | 200 | 200 | 124 | ok |
| district_pulse | bad-date | 400 | 400 | 133 | ok |
| district_recent_visits | default | 200 | 200 | 1622 | ok |
| district_recent_visits | limit-0 | 200 | 200 | 328 | ok |
| district_recent_visits | limit-neg | 200 | 200 | 243 | ok |
| district_recent_visits | limit-huge | 200 | 200 | 691 | ok |
| district_recent_visits | no-home-name | 200 | 200 | 243 | ok |
| last_sync | good | 200 | 200 | 186 | ok |
| watch | anon | 401 | 401 | 125 | ok |
| unwatch | anon | 401 | 401 | 120 | ok |
| my_watches | anon | 401 | 401 | 116 | ok |
| alert_detail | anon | 401 | 401 | 130 | ok |
| register_device | anon | 401 | 401 | 131 | ok |
| watch | garbage-jwt | 401 | 401 | 158 | ok |
| watch | forged-jwt | 401 | 401 | 126 | ok |
| daycare_search | alg-none | 401 | 401 | 121 | ok |
| schema core | profile | 406 | 406 | 110 | ok |
| schema app | profile | 406 | 406 | 129 | ok |
| schema geo | profile | 406 | 406 | 117 | ok |
| schema ops | profile | 406 | 406 | 115 | ok |
| schema staging | profile | 406 | 406 | 107 | ok |
| schema auth | profile | 406 | 406 | 113 | ok |
| schema storage | profile | 406 | 406 | 121 | ok |
| schema vault | profile | 406 | 406 | 127 | ok |
| public table daycares | direct | 404 | 404 | 134 | ok |
| public table watches | direct | 404 | 404 | 120 | ok |
| public table devices | direct | 404 | 404 | 178 | ok |
| refresh_aggregates | internal | 404 | 404 | 113 | ok |
| core.today via rpc | internal | 404 | 404 | 131 | ok |
| write via POST table | direct | 404 | 404 | 139 | ok |
| auth admin users | admin | 401|403 | 403 | 183 | ok |
| storage buckets | storage | 200|400|401|403 | 200 | 235 | ok |
| watch | user A | 204 | 204 | 150 | ok |
| watch | user A again | 204 | 204 | 115 | ok |
| watch | unknown id | 404 | 404 | 122 | ok |
| watch | text id | 400 | 400 | 132 | ok |
| my_watches | user A | 200 | 200 | 136 | ok |
| my_watches | user B sees none | 200 | 200 | 262 | ok |
| unwatch | user B on A's | 204 | 204 | 234 | ok |
| my_watches | A kept after B | 200 | 200 | 137 | ok |
| alert_detail | unknown event | 200 | 200 | 116 | ok |
| alert_detail | text event | 400 | 400 | 245 | ok |
| register_device | not expo | 400 | 400 | 142 | ok |
| register_device | bad platform | 400 | 400 | 122 | ok |
| register_device | sql token | 400 | 400 | 124 | ok |
| register_device | huge token | 400 | 400 | 140 | ok |
| unwatch | user A | 204 | 204 | 116 | ok |
| my_watches | A empty | 200 | 200 | 135 | ok |
| app schema as user | profile | 406 | 406 | 135 | ok |
| daycare_search x50 parallel | load | 200 x50 | 50/50 | p95 1781 / max 1935 | ok |
