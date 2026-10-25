# Test report

What we tested, how, and what happened, Oct 24 to 25 2026. Each case was run by a teammate who did not build that screen.

**Result:** PASS · FAIL (listed under Problems found, with its fix) · PENDING (not run yet) · ON DEVICE (needs a real iPhone) · CUT (out of scope, reason in the row)
**Where:** app cases ran on iOS simulators against a local copy of the database (same records as the cloud). Flows are in `apps/mobile/e2e/qa/`; screenshots are in [`docs/qa/`](qa/).

## Backend and data

| # | Case | Method | Result | Evidence |
|---|---|---|---|---|
| B1 | Schema, row-level security (every allow and every deny), RPC shapes, views, photo rules, recent visits | pgTAP | PASS | `supabase test db` → Files=12, Tests=195, PASS (Oct 25) |
| B2 | The app's API path: public reads, anonymous sign-in, watch / unwatch / re-watch, internal tables unreachable | `supabase/snippets/api_smoke.sh` | PASS | local 21/21, cloud 21/21 (Oct 25) |
| B3 | The nightly sync on a night with no changes creates no events | `python -m pipeline sync --dry-run --no-notify` | PASS | events_new_violation 0, events_daycare 0, inspections_new 0, join_rate 1.0 ([log](qa/resync-dryrun.log)) |
| B4 | An alert for a daycare you no longer watch is not shown | `EVENT_ID=43 EVENT_OP=1304920 supabase/snippets/api_smoke.sh` | PASS | hidden before watching, shown while watching (is_replay=true), hidden after unwatch; 24/24 |
| B5 | RPC latency p95 under 100 ms | `supabase/snippets/bench_rpc.sql` | PASS | search p50 3.3 / p95 24.6 ms, near 6.5 ms, record 1.9 ms (60 runs each, as the anon role, on a busy laptop) |
| B6 | A push reaches a real iPhone | replay → Expo ticket → receipt → banner | PASS | event 43, ticket 01a17151-582b-75bd-89b2-ccba6e7ae980, receipt `delivered_to_provider`, banner shown on the phone 11:31 pm Oct 24 |
| B7 | Push on Android | | CUT | Expo Go on Android has no remote push |
| B8 | "In TX-04" is shown only when the map point is inside the district | pgTAP + SQL + source | PASS | 379 by point, 23 by county only; every app check is `in_district && district_basis === 'point'` (HomeMap.tsx:66, HomeMap.web.tsx:52, PlacePage.tsx:190); `district_pulse_weekly` and `district_recent_visits` filter on the point basis (pgTAP 004, 008) |
| B9 | Replays are labelled as replays | push body + alert screen | PASS | push body starts `Replay of a real state record from {date}:` (notify.py:49); the alert screen shows "Replay of a real state record" when `is_replay` (alert/[eventId].tsx:69); on screen in U21 |
| B10 | A fresh clone builds and passes from zero | second stack: `supabase start` → `supabase test db` → `uv run python -m pipeline backfill` → `pytest` | PASS | start 33 s; pgTAP passed on the seed alone (the tests load the real rows in `supabase/tests/fixtures/real_rows.psql` and roll them back); cold backfill 259.9 s, 14,310 daycares, 379 in TX-04 by point, the same as the loaded database. Run 4:33 am Oct 25 with 180 tests; the suite has 195 now |

## Every endpoint, cloud and local

`supabase/snippets/api_endpoints.sh` calls each of the 12 RPCs plus the REST, auth and storage paths with good, empty, bad, huge (20,000 characters), unicode, emoji and SQL-like input, signed out, with a forged or `alg: none` token, and as two signed-in users. Any 5xx fails. Full tables: [local](qa/endpoints-local.md), [cloud](qa/endpoints-cloud.md). Latest: local 96/96, cloud 94/94 (1:44 pm Oct 25). Two device-registration cases run on local only, so no test token reaches the cloud push list.

| # | Case | Method | Result | Evidence |
|---|---|---|---|---|
| E1 | Public reads: `daycare_search`, `daycares_near`, `daycare_record`, `area_compare`, `district_pulse`, `district_recent_visits`, `last_sync` | 51 cases | PASS | local and cloud 51/51: empty, blank or null → `[]`; huge input capped at 50 rows (search) and 200 (near); bad number or date → 400; unknown id → `null`; `'; drop table …` and `' or '1'='1` return plain results; `%` and `_` match nothing; `Pequenos` finds "Los Pequeños Exploradores"; the iPhone's curly apostrophe works like a straight one |
| E2 | Privacy holds through the API | jq on every row | PASS | no home from search or near has a street or a ZIP longer than 5 digits; `district_recent_visits` never names a home; at most 2 photos |
| E3 | Signed out: no writes, no private reads | 8 cases | PASS | `watch`, `unwatch`, `my_watches`, `alert_detail`, `register_device` → 401; garbage, forged (`role: service_role`, bad signature) and `alg: none` tokens → 401 |
| E4 | Nothing else is reachable | 16 cases | PASS | `core`, `app`, `geo`, `ops`, `staging`, `auth`, `storage`, `vault` → 406; no public tables (404); internal functions → 404; auth admin → 403; storage has no buckets |
| E5 | Signed in: your own data only | 16 local / 14 cloud | PASS | user B sees none of A's watches, and B's unwatch leaves A's alone; watch is idempotent; unknown event → `null`; unknown daycare → 404, not 500 (D25) |
| E6 | 50 parallel calls | `xargs -P 50` | PASS | local 50/50 200, p95 58 ms; cloud 50/50 200, p95 1,106 ms (one burst from one laptop, free tier) |
| E7 | Cloud latency, warm (12 runs each, from Frisco, about 125 ms of network round trip included) | curl | PASS | p50: record 136, area 126, pulse 135, search 151 (typo 242), near 206, recent visits 261 ms. The first call after idle took 2.6 s |

## Street pictures

| # | Case | Method | Result | Evidence |
|---|---|---|---|---|
| P1 | A Mapillary photo shows only after a person checked that it shows that daycare; at most 2; never a home or an approximate point | pgTAP 009, 011 | PASS | an unchecked newer photo is never returned; a checked photo taken before the current permit is shown; the 6-year limit holds. Cloud, Oct 25: 1509829 Dallas Torah Center Preschool returns its 2 checked photos with the photographer credit |
| P2 | Apple Look Around matched by the same name shows the right building | MapKit probe with the app's rules, every snapshot looked at | PASS with a note | 3 of 20 random TX-04 centers and 2 of the 40 nearest Frisco centers get one; all 5 show the right building. Rise Academy (1433122): "301" matches the address but the gable still reads "Rainbow End" (Look Around gives no capture date) |
| P3 | "The street at this address" shows only where a person saw that the building is the clear subject | probe + eye check → `core.street_view_checks` | PASS | of 37 street views checked, 3 pass; 34 show trees, roads, fields, an intersection or another business (a massage sign, a loft storefront). `daycare_record().daycare.street_view_checked` is true only for the 3 (pgTAP 012), on the cloud too (144589, 1194568, 1238089) |
| P4 | 0, 1 and 2 photo states, the overhead page once, a load failure drops the page | Release build, `e2e/qa/photos.sh` | PARTIAL | 2:54 pm Oct 25: YMCA @ Norris Elementary (1194568, hand-checked) opens on "Street at this address · Apple Look Around" with the school as the subject, then the 3D view, 2 pages ([shot](qa/p4-1194568-street.jpg)); Childrens Lighthouse (507034) has one page. The run stopped there: a sideways swipe on a one-page hero opens the full-screen viewer |

## App (iOS simulator)

| # | Case | Method | Result | Evidence |
|---|---|---|---|---|
| U1 | First launch: onboarding, then home | Maestro | PASS | Get started → how it works → Find your daycare → Use my location → pick → Watch → Not now → "You’re watching …" → home ([welcome](qa/u01-0-welcome.jpg), [how](qa/u01-0b-how.jpg), [done](qa/u01-3-done.jpg), [home](qa/u01-4-home.jpg)) |
| U2 | Location allowed | Maestro + simctl location | PASS | map centered on the blue dot in Plano, "Closest to you" from the same point, no "Location is off" ([home](qa/u01-4-home.jpg)). D1, D2 fixed |
| U3 | Location denied | Maestro + simctl privacy revoke | PASS | "Daycares near you · Near your last location", map and list agree ([u03](qa/u03-denied-0.jpg)) |
| U4 | Location outside Texas | Maestro + simctl location | PASS | Oklahoma City: "Daycares near Frisco · No Texas daycares near you" ([u04](qa/u04-outside-0.jpg)) |
| U5 | Offline | airplane mode | ON DEVICE | a simulator shares the Mac's network. Expect the cached record and an offline notice, never a blank screen or an endless spinner |
| U6 | Slow network | Network Link Conditioner, "Very Bad Network" | ON DEVICE | expect skeletons, then content or "We couldn’t reach the state record" with Try again |
| U7 | Search: name | Maestro | PASS | "Viva World" → Viva World School ([u07](qa/u07-name.jpg)) |
| U8 | Search: no match | Maestro | PASS | "zzqxv" → no rows, no crash ([u08](qa/u08-no-hit.jpg)) |
| U9 | Search: ZIP | Maestro | PASS | "75087" → Rockwall daycares ([u09](qa/u09-zip.jpg)) |
| U10 | Search: city | Maestro | PASS | "Sherman" → Sherman daycares ([u10](qa/u10-city.jpg)) |
| U11 | Search: typo | Maestro | PASS | "Lionhart" → Lionheart Children’s Academy ([u11](qa/u11-typo.jpg); pgTAP 010) |
| U12 | Center: aerial imagery shown with its credit | Maestro | PASS | the aerial page shows the pin and "Imagery © Esri, Maxar"; the 3D page shows a pin (D17) |
| U13 | Home daycare: no street address, no imagery, no house pin | Maestro | PASS | 1490119: no imagery, no street line; the database returns no address and a rounded point (pgTAP 011) ([u13](qa/u13-home-0.jpg)) |
| U14 | Place with no findings | Maestro | PASS | 228100 Stonebriar Preschool Pals: "No problems cited at the May 13 visit", no verdict words ([u14](qa/u14-zero-0.jpg)) |
| U15 | Place with many findings | Maestro | PASS | 97587 (220 findings) renders and "See all" works ([u15](qa/u15-many-0.jpg)) |
| U16 | Place with an approximate location | Maestro | PASS | 98685: "Approximate location" clear of the map's Legal mark, area circle, no pin ([u16](qa/u16-approx-0.jpg)); 1120831 with no point renders. D4 fixed |
| U16b | A home daycare never shows photos | pgTAP 009 + Maestro | PASS | 1462404: "Neighborhood only · private home", no photo, no 3D view ([home](qa/u16b-home.jpg)) |
| U16c | An approximate location never shows photos | pgTAP 009 + Maestro | PASS | 98685: "Approximate location", no photo ([approx](qa/u16c-approx.jpg)) |
| U16d | Photo credit (Mapillary, CC BY-SA) and month visible | Maestro | PASS | "© Mapillary contributors · CC BY-SA" with the month (D16 fixed) |
| U17 | Fix status comes from the state's own fields, never "Fixed" from a due date | Maestro + text search | PASS | 1459611 shows "Fix due Oct 30", never "Fixed … Oct 30" ([u17](qa/u17-viva-0.jpg)) |
| U18 | Watch, unwatch, re-watch | Maestro | PASS | 97587: watch → sheet → "You’re watching" → "Watching ·" → "Stop watching" → re-watch; the row is in `app.watches` ([stop sheet](qa/u18-2b-stop-sheet.jpg)). D10 fixed |
| U19 | Notifications allowed | Maestro | PASS | "Turn on alerts" → iOS prompt → Allow → done. A simulator never gets a push token, so the page reads "alerts off"; "alerts on" is shown on a real iPhone (B6) |
| U20 | Notifications denied | Maestro | PASS | after "Don’t Allow" the place button no longer says "alerts on" ([u20](qa/u20-0-place-denied.jpg)); the sheet says notifications are off and offers Settings. D9 fixed |
| U21 | Tap a push with the app closed | Release build + `simctl push` + Maestro (`e2e/qa/push-tap.sh`) | PASS | the real replay message for Viva World School (3 findings, Oct 5 visit) arrives as a banner; the tap opens that alert: "Replay of a real state record", "3 problems found at the Oct 5 visit", the inspector's words, Open full record ([alert](qa/r21-1-alert.jpg)) |
| U22 | Tap a push with the app open | Maestro | PASS | the route a tap opens (`/alert/43?operationId=1304920`, a real event, watched) shows the replay label, the finding and the inspector's words ([alert](qa/u22-warm-alert.jpg)) |
| U23 | Tap a push with the app in the background | Release build + `simctl push` + Maestro | PASS | same banner, the tap opens the alert ([alert](qa/r23-1-alert.jpg)) |
| U24 | Share | Maestro | PASS | opens the iOS share sheet ([sheet](qa/u24-share-sheet.jpg)) |
| U25 | Rights request letter | Maestro | PASS | Request records / Drop in without notice / Ask to inspect video with "Texas Human Resources Code §42.04271"; "Request records" opens the share sheet with the letter ([tab](qa/u25-rights-tab.jpg), [sheet](qa/u25-request-sheet.jpg)) |
| U26 | Tour questions | Maestro | PASS | questions come from the daycare's own findings (6 safety, 2 paperwork, 1 health = 9, matching "Problems 9") ([card](qa/u26-tour-card.jpg), [tour](qa/u26-tour.jpg)) |
| U27 | "View on the state's site" from a finding and from the place page | Maestro | PASS | place page "State record"; finding card link on the alert screen ([alert](qa/u22-warm-alert.jpg)) |
| U28 | Dark mode | Maestro + simctl appearance | PASS | place, home daycare, search ([place](qa/u28-dark-0-place.jpg), [home](qa/u28-dark-2-home.jpg), [search](qa/u28-dark-3-search.jpg)) |
| U29 | Largest accessibility text size | Maestro + simctl content_size | PASS | wraps with no clipping ([place](qa/u29-xxxl-0-place.jpg), [home](qa/u29-xxxl-2-home.jpg)) |
| U30 | VoiceOver label on every control | accessibility tree | PASS | home sheet, chips, cards and list reachable (D11); pins read "<name>, Center" or "N daycares here. Zooms in." (D12); findings read "Serious. <finding>. <date>. Fixed · state checked."; tabs report which one is open; each rights action is one element |
| U31 | Wording: never safe, unsafe, score, grade or rank | text search of source | PASS | only code names, "never a score" comments, and the state's own rule title "Report Unsafe Facility Occurrence" (verbatim) |

## Every screen on four devices

`apps/mobile/e2e/qa/matrix.sh` installs the Release build on each simulator, clears it (and Apple Maps' tile cache, so the first launch is cold), and takes the same 12 screens: welcome, how it works, find, alerts, done, home, two place pages (two screens each), Your rights, Watching. Light, dark, and the largest accessibility text size. Latest run: 2:50 pm Oct 25, 8 of 9 iPhone cells pass.

| # | Device | Light | Dark | Largest text |
|---|---|---|---|---|
| X1 | iPhone SE (3rd gen), 667 pt | PASS ([sheet](qa/matrix-ios-SE3-light.jpg)) | PASS ([sheet](qa/matrix-ios-SE3-dark.jpg)) | FAIL → D28: the find card's name sits under the buttons, so the pick misses ([shot](qa/D28-se-xxxl-name-under-buttons.jpg)) |
| X2 | iPhone 17 | PASS ([sheet](qa/matrix-ios-17-light.jpg)) | PASS ([sheet](qa/matrix-ios-17-dark.jpg)) | PASS with D28 ([sheet](qa/matrix-ios-17-xxxl.jpg)) |
| X3 | iPhone 17 Pro Max | PASS ([sheet](qa/matrix-ios-ProMax-light.jpg)) | PASS ([sheet](qa/matrix-ios-ProMax-dark.jpg)) | PASS ([sheet](qa/matrix-ios-ProMax-xxxl.jpg)) |
| X4 | iPad (app runs in its iPhone window) | welcome renders ([shot](qa/ipad-letterbox-welcome.jpg)); the 12-screen tour can't be automated there, because Maestro gets no element tree from an iPhone app on iPad | | |

## Motion (150 to 250 ms, no overshoot, press 0.98, first-load stagger only, Reduce Motion respected)

| # | Case | Method | Result | Evidence |
|---|---|---|---|---|
| M1 | No overshoot or bounce | source search of spring configs | PASS | springs clamp overshoot; D6, D7 fixed |
| M2 | Durations 150 to 250 ms (sheet excepted); press is 0.98 scale and 0.9 opacity | source search of durations | PASS | D8 fixed; AlertBanner 250 ms |
| M3 | Lists animate only on first load | source | PASS | the home carousel fades once outside its list (`HomeMap.tsx:260`); rows keyed by `operation_id`, visit dots by `v.id` (`RecordStrip.tsx:245-251`), so a refetch never remounts them |
| M4 | Reduce Motion on: movement becomes fades | simctl Reduce Motion + pixel check | PASS | with Reduce Motion on, 0 of 924,000 hero pixels change in 8 s; with it off, 683,981 change (the slow drift) ([m04](qa/m04-place.jpg)). D19 fixed |
| M5 | Done screen: one check draw of 400 ms or less plus a success haptic, nothing else | source | PASS | `Celebration.tsx`: badge fade 200 ms, check wipe 350 ms, success haptic |
| M6 | Never two things moving for attention on one screen | source | PASS | one entrance per screen; the 3D view keeps a slow 9 s drift while the page is open and stops under Reduce Motion |
| M7 | One recorded pass of the filmed path: onboarding with alerts allowed, watch, a place page, Your rights, a replayed alert tapped from the background | `e2e/qa/film.sh` on the Release build: screen recording, then flash (frame brightness jump), cut and freeze checks | PASS | build ab147e5: 199 s, 0 flashes, 23 cuts, all at taps, but D34, D35, D36. Fix build (Oct 25, 3:47 pm): 137 s, 0 flashes, 12 cuts; the done screen stays put, the photo swipe stays on the page, the background alert tap opens the alert |

## Web link (https://daycare-watch.vercel.app)

| # | Case | Method | Result | Evidence |
|---|---|---|---|---|
| W1 | Search at 1440 px | Chrome | PASS (local build) | "Lionhart" → Lionheart centers; rows show type · city · last visit |
| W2 | Place page at 1440 px | Chrome | PASS (local build) | `/daycare/1279336`: Esri image, pin and credit, real findings with fix status, "Alerts need the app" |
| W3 | Rights at 1440 px | Chrome | PASS (local build) | 3 actions and §42.04271; "Request records" builds the letter with the daycare's name |
| W4 | Search, place and rights at 390 px | Chrome | PASS (local build) | no sideways scroll on all three; "75034" returns Frisco rows |
| W5 | No anonymous sign-in on the web | Resource Timing + storage | PASS (local build) | 0 of 70 requests hit `/auth/v1`; no session keys stored |
| W6 | The web bundle has no street-photo code or keys | search of the web export | PASS | 0 hits for the Mapillary token, `graph.mapillary.com` and `service_role`; the API URL found once as a control |
| W7 | Every route answers on a cold open or refresh | `apps/mobile/e2e/qa/web-routes.sh` (20 routes + assets) | PASS | 2:22 pm Oct 25 on the live link: 25 of 25 return 200 (20 routes, an unknown path that gets the app's own not-found screen, and every shell asset). D24 fixed |
| W8 | Lighthouse 90 or higher, mobile and desktop | `LIGHTHOUSE=1 apps/mobile/e2e/qa/web-routes.sh` | PASS desktop, FAIL mobile → D26 | 3:13 pm Oct 25, performance / accessibility / best practices / SEO. Desktop: `/` 97 / 100 / 100 / 92, place page 98 / 100 / 100 / 92, Your rights 98 / 100 / 100 / 92 (LCP 1.0 to 1.1 s, TBT 0 ms). Mobile: `/` 81 / 100 / 100 / 92 (LCP 5.1 s, TBT 50 ms), place page 56 / 100 / 100 / 92 (LCP 8.5 s, TBT 280 ms), Your rights 67 / 94 / 100 / 91 (LCP 5.7 s). Re-run 4:00 pm, mobile: `/` 65 / 100 / 100 / 92 (LCP 5.5 s, TBT 60 ms), place page 72 / 100 / 100 / 92 (LCP 6.3 s, TBT 190 ms), Your rights 67 / 94 / 100 / 91 (LCP 5.5 s, TBT 70 ms); the machine was busy, so performance moves 10 to 15 points between runs. Lighthouse throttles mobile to a slow 4G phone |
| W9 | Every width, light and dark, on the live link | Chrome with real mobile emulation (`isMobile`, 2x) at 360, 390, 430, 768, 1024, 1280, 1440, 1920 px × light, dark × `/`, a place page, Your rights, Watching, a search link | PASS with D31, D32, D33 | 80 of 80 views have no sideways scroll. Up to 430 px the app fills the screen; from 768 px it sits in an iPhone frame beside a column with one `h1`, a `main` landmark and a QR code ([phones](qa/web-phone-390.jpg), [wide](qa/web-frame-wide.jpg)) |

## Problems found

| # | Case | Found | Screenshot | What we saw | Status |
|---|---|---|---|---|---|
| D1 | U2 | Oct 25 | [D1](qa/D1-map-not-centered.jpg) | the map did not center on the parent's location | FIXED, re-tested |
| D2 | U2 | Oct 25 | [D2](qa/D2-location-off-label.jpg) | "Location is off" shown with location allowed | FIXED, re-tested |
| D3 | U13 | Oct 25 | [D3](qa/D3-home-circle-centered.jpg) | home circle looked centered on the house | WITHDRAWN: the circle snaps to a 0.005° grid, 282 m off; the database also rounds home points |
| D4 | U16 | Oct 25 | [D4](qa/D4-approx-caption.jpg) | "Approximate location" caption collided with the map's Legal mark | FIXED, re-tested |
| D5 | U12 | Oct 25 | | the Esri credit showed over a blank image before tiles loaded | FIXED (credit waits for the first tile, `MapSnapshot.tsx:87-144`) |
| D6 | M1 | Oct 25 | `PlacePage.tsx:144` | the Watch confirm popped to 1.05 | FIXED |
| D7 | M1, M2 | Oct 25 | `RecordStrip.tsx:237` | a zoom-in over up to 20 dots took about 960 ms | FIXED |
| D8 | M2 | Oct 25 | `NumberCard.tsx:78` | a 700 ms ring fill | FIXED |
| D9 | U20 | Oct 25 | [u20](qa/u20-0-place-denied.jpg) | the place page said "alerts on" with notifications denied | FIXED, re-tested |
| D10 | U18 | Oct 25 | [before](qa/u18-2-place-watching.jpg) → [after](qa/u18-3-unwatched.jpg) | one tap unwatched with no confirm or undo | FIXED, re-tested |
| D11 | U30 | Oct 25 | | the home list was one "Bottom Sheet" element, unreachable by VoiceOver | FIXED, re-tested |
| D12 | U30 | Oct 25 | | 95 map pins read only "Map pin" | FIXED, re-tested |
| D13 | U15 | Oct 25 | [u28](qa/u28-dark-0-place.jpg) | "3 problems at the Oct 5 visit" then "See all 9" with no context | FIXED ("See all 9 from the past 2 years"), re-tested |
| D14 | U1 | Oct 25 | [u01](qa/u01-3-done.jpg) | the done screen promised alerts after "Not now" | FIXED, re-tested |
| D15 | P1 | Oct 25 | [u16a](qa/u16a-3-1-photo.jpg) | forward dashcam frames (car hood in shot) chosen as photos | FIXED (sideways frames only, one per pass) |
| D16 | U16d | Oct 25 | [u16d](qa/u16d-viewer.jpg) | the photo credit lacked the CC BY-SA license name | FIXED, re-tested |
| D17 | U12, U14 | Oct 25 | [u14](qa/u14-zero-0.jpg) | the 3D view had no pin, so you couldn't tell which building | FIXED, re-tested |
| D18 | U30 | Oct 25 | | search field missing from one accessibility snapshot | WITHDRAWN: present at every other sheet height |
| D19 | M4 | Oct 25 | [D19](qa/D19-reduce-motion-caption.jpg) | under Reduce Motion the Esri image was captioned "3D view · Apple Maps" | FIXED, re-tested with the pixel check |
| D20 | W1–W4 | Oct 25 | | the web build was blank on every route (`codegenNativeComponent is not a function` from react-native-maps) | FIXED (`FlyoverHero.web.tsx`), re-tested |
| D21 | W4 | Oct 25 | | web tabs had `role=tab` but no `aria-selected` | FIXED, re-tested |
| D22 | U30 | Oct 25 | | the watch sheet always said a notification prompt was next, but iOS asks only once | FIXED, re-tested |
| D23 | B1 | Oct 25 | | the API returned a home daycare's ZIP+4 (often one block face) for 4,598 of 4,705 homes | FIXED by migration `20261025110000_home_zip5.sql` + 3 pgTAP asserts that failed before the fix; verified on the cloud |
| D24 | W7 | Oct 25 | | every deep link on the web link returned 404; only `/` loaded (`vercel.json` rewrote to `/index.html`, which `cleanUrls` redirects) | FIXED (rewrite to `/`), re-tested on the live link: 25 of 25 |
| D25 | E5 | Oct 25 | | `watch` on an unknown daycare returned 500, and `register_device` stored a 20,000-character token | FIXED by migration `20261025130000_rpc_http_errors.sql` + pgTAP; verified on the cloud |
| D26 | W8 | Oct 25 | | Lighthouse mobile performance under 90. Fixed: the 447 KB icon font, preconnect to the API and tile server, image `alt`. Left: about 690 KB of JavaScript in one bundle, 12 map tiles over HTTP/1.1; on mobile Your rights, the bottom tabs have no `tablist` parent and row labels don't start with the visible text | OPEN on mobile; desktop passes |
| D27 | X1 | Oct 25 | [D27](qa/D27-se-pin-on-wordmark.jpg) | iPhone SE welcome: the building pin sat on the "Daycare Watch" wordmark; the Apple Maps logo was half under Get started | FIXED, re-tested on the SE (light, dark) |
| D28 | X1, X2 | Oct 25 | [D28](qa/D28-se-find-clipped.jpg), [largest text](qa/D28-se-xxxl-name-under-buttons.jpg) | onboarding Find: the card's last line was cut by the pinned buttons. Fixed at the default text size; at the largest text size the SE still hides the whole name under the buttons and the iPhone 17 cuts the last line | OPEN at the largest text size |
| D29 | X2 | Oct 25 | [D29](qa/D29-xxxl-done-clipped.jpg) | iPhone 17, largest text, the onboarding done screen: the last line ran under the button | FIXED, re-tested |
| D30 | X3 | Oct 25 | [D30](qa/D30-welcome-hero-blank.jpg) | iPhone 17 Pro Max, first launch: the welcome image was flat grey with only the pin while the caption said "3D view, Apple Maps" | FIXED, re-tested on a cold launch with Apple Maps' cache cleared on 3 iPhones |
| D31 | W9 | Oct 25 | [D31](qa/D31-web-search-query-ignored.jpg) | a search link (`/search?q=Montessori`) opens an empty search box with no results, so a shared search shows nothing | FIXED, re-tested live 4:00 pm: the box reads "Montessori" with results ([after](qa/D31-fixed-search-link.jpg)) |
| D32 | W9 | Oct 25 | [D32](qa/D32-web-watching-skeleton.jpg) | Watching on the web stays on loading placeholders: after 10 s there is no request and no message (the web has no sign-in, so it can never load) | FIXED, re-tested live 4:00 pm: "Watching works in the iPhone app" and a link to find a daycare |
| D33 | W9 | Oct 25 | [D33](qa/D33-web-credit-covered.jpg) | place page at 390 px: the "Placed from the street address" label covers "Imagery" in the Esri credit | FIXED, re-tested live 4:00 pm: the label sits above the credit ([after](qa/D33-fixed-credit-clear.png)) |
| D34 | M7 | Oct 25 | [D34](qa/D34-allow-opens-record.jpg) | after Allow on the iOS notification prompt, the done screen opens the watched daycare's record by itself 0.8 s later (in the simulator the Allow tap also reaches the card under the prompt) | FIXED, the card ignores taps for 1.5 s; re-tested (M7) |
| D35 | M7 | Oct 25 | [D35](qa/D35-hero-swipe-opens-viewer.jpg) | a sideways swipe on a place's single 3D picture opens the full-screen viewer, and the next scrolls turn the 3D view | FIXED, the viewer opens only on a tap (finger moved 10 pt or less); re-tested (M7) |
| D36 | M7 | Oct 25 | [D36](qa/D36-push-tap-under-viewer.jpg) | with that viewer open and the app in the background, tapping the alert brings back the viewer, not the alert | FIXED, the viewer closes when the place page loses focus; re-tested on the fix build with Look Around open ([after](qa/D36-fixed-alert-over-viewer.jpg)) |
