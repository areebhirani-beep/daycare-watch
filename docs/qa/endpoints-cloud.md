Endpoint test against `https://yqrrfawmsvhxgffgrmse.supabase.co`: 94 passed, 0 failed (2026-10-25 13:02 CDT)

| Endpoint | Input | Expected | Got | ms | Result |
|---|---|---|---|---|---|
| daycare_search | good | 200 | 200 | 142 | ok |
| daycare_search | zip | 200 | 200 | 164 | ok |
| daycare_search | typo | 200 | 200 | 1738 | ok |
| daycare_search | empty | 200 | 200 | 140 | ok |
| daycare_search | blank | 200 | 200 | 123 | ok |
| daycare_search | null | 200 | 200 | 123 | ok |
| daycare_search | missing-arg | 404 | 404 | 132 | ok |
| daycare_search | huge-20k | 200 | 200 | 161 | ok |
| daycare_search | unicode | 200 | 200 | 159 | ok |
| daycare_search | accent-off | 200 | 200 | 137 | ok |
| daycare_search | emoji | 200 | 200 | 723 | ok |
| daycare_search | curly-quote | 200 | 200 | 138 | ok |
| daycare_search | sql-drop | 200 | 200 | 299 | ok |
| daycare_search | sql-or | 200 | 200 | 231 | ok |
| daycare_search | like-wild | 200 | 200 | 196 | ok |
| daycare_search | like-under | 200 | 200 | 412 | ok |
| daycare_search | backslash | 200 | 200 | 330 | ok |
| daycare_search | nul-byte | 400 | 400 | 141 | ok |
| daycare_search | bad-json | 400 | 400 | 151 | ok |
| daycare_search | get-form | 200 | 200 | 305 | ok |
| daycare_search | no-home-street | 200 | 200 | 219 | ok |
| daycares_near | good | 200 | 200 | 316 | ok |
| daycares_near | km-zero | 200 | 200 | 126 | ok |
| daycares_near | km-negative | 200 | 200 | 228 | ok |
| daycares_near | km-huge | 200 | 200 | 370 | ok |
| daycares_near | lat-91 | 200 | 200 | 124 | ok |
| daycares_near | lat-1e308 | 200 | 200 | 149 | ok |
| daycares_near | lat-text | 400 | 400 | 133 | ok |
| daycares_near | null-island | 200 | 200 | 127 | ok |
| daycares_near | filters-junk | 200 | 200 | 144 | ok |
| daycares_near | filters-text | 200 | 200 | 133 | ok |
| daycares_near | home-rounded | 200 | 200 | 232 | ok |
| daycare_record | good | 200 | 200 | 129 | ok |
| daycare_record | photos-max-2 | 200 | 200 | 136 | ok |
| daycare_record | unknown-id | 200 | 200 | 121 | ok |
| daycare_record | null-id | 200 | 200 | 138 | ok |
| daycare_record | bigint-max | 200 | 200 | 143 | ok |
| daycare_record | overflow | 400 | 400 | 206 | ok |
| daycare_record | text-id | 400 | 400 | 221 | ok |
| area_compare | good | 200 | 200 | 168 | ok |
| area_compare | unknown-id | 200 | 200 | 145 | ok |
| area_compare | text-id | 400 | 400 | 127 | ok |
| district_pulse | default | 200 | 200 | 113 | ok |
| district_pulse | null | 200 | 200 | 124 | ok |
| district_pulse | far-future | 200 | 200 | 120 | ok |
| district_pulse | bad-date | 400 | 400 | 117 | ok |
| district_recent_visits | default | 200 | 200 | 1675 | ok |
| district_recent_visits | limit-0 | 200 | 200 | 228 | ok |
| district_recent_visits | limit-neg | 200 | 200 | 231 | ok |
| district_recent_visits | limit-huge | 200 | 200 | 345 | ok |
| district_recent_visits | no-home-name | 200 | 200 | 238 | ok |
| last_sync | good | 200 | 200 | 127 | ok |
| watch | anon | 401 | 401 | 130 | ok |
| unwatch | anon | 401 | 401 | 125 | ok |
| my_watches | anon | 401 | 401 | 209 | ok |
| alert_detail | anon | 401 | 401 | 143 | ok |
| register_device | anon | 401 | 401 | 113 | ok |
| watch | garbage-jwt | 401 | 401 | 246 | ok |
| watch | forged-jwt | 401 | 401 | 149 | ok |
| daycare_search | alg-none | 401 | 401 | 126 | ok |
| schema core | profile | 406 | 406 | 126 | ok |
| schema app | profile | 406 | 406 | 127 | ok |
| schema geo | profile | 406 | 406 | 131 | ok |
| schema ops | profile | 406 | 406 | 138 | ok |
| schema staging | profile | 406 | 406 | 125 | ok |
| schema auth | profile | 406 | 406 | 114 | ok |
| schema storage | profile | 406 | 406 | 129 | ok |
| schema vault | profile | 406 | 406 | 123 | ok |
| public table daycares | direct | 404 | 404 | 132 | ok |
| public table watches | direct | 404 | 404 | 119 | ok |
| public table devices | direct | 404 | 404 | 124 | ok |
| refresh_aggregates | internal | 404 | 404 | 139 | ok |
| core.today via rpc | internal | 404 | 404 | 139 | ok |
| write via POST table | direct | 404 | 404 | 127 | ok |
| auth admin users | admin | 401|403 | 403 | 221 | ok |
| storage buckets | storage | 200|400|401|403 | 200 | 890 | ok |
| watch | user A | 204 | 204 | 308 | ok |
| watch | user A again | 204 | 204 | 143 | ok |
| watch | unknown id | 404 | 404 | 128 | ok |
| watch | text id | 400 | 400 | 220 | ok |
| my_watches | user A | 200 | 200 | 180 | ok |
| my_watches | user B sees none | 200 | 200 | 158 | ok |
| unwatch | user B on A's | 204 | 204 | 119 | ok |
| my_watches | A kept after B | 200 | 200 | 118 | ok |
| alert_detail | unknown event | 200 | 200 | 133 | ok |
| alert_detail | text event | 400 | 400 | 127 | ok |
| register_device | not expo | 400 | 400 | 145 | ok |
| register_device | bad platform | 400 | 400 | 128 | ok |
| register_device | sql token | 400 | 400 | 136 | ok |
| register_device | huge token | 400 | 400 | 172 | ok |
| unwatch | user A | 204 | 204 | 110 | ok |
| my_watches | A empty | 200 | 200 | 234 | ok |
| app schema as user | profile | 406 | 406 | 260 | ok |
| daycare_search x50 parallel | load | 200 x50 | 50/50 | p95 3624 / max 3784 | ok |
