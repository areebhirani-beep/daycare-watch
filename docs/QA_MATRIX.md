# QA matrix

Every user case, how it is tested, and the result. Owner: platform (QA lead).
Rows are tested cold, by someone who did not write the UI.

**Status:** PASS · FAIL (filed to the owner) · PENDING (not run yet) · CUT (out of scope by CONTRACT decision)
**Where:** UI rows run on the iPhone 17 Pro Max simulator in Expo Go against the local stack (same data as cloud). Flows are in `apps/mobile/e2e/qa/`, screenshots in `harness/state/qa/`.

## Backend and data

| # | Case | Method | Status | Evidence | Owner if it fails |
|---|---|---|---|---|---|
| B1 | Schema, RLS allow + deny, RPC shapes, views, photos rule, recent visits | pgTAP | PASS | `supabase test db` → Files=11, Tests=177, PASS (01:51 Oct 25; adds search typos, home privacy, photo age) | platform |
| B2 | App API path: public reads, anonymous sign-in, watch / unwatch / re-watch idempotent, `core`/`app`/`ops` tables unreachable | `supabase/snippets/api_smoke.sh` | PASS | local 21/21; cloud `yqrrfawmsvhxgffgrmse` 21/21 | platform |
| B3 | Daily sync on a no-change night creates no events | `python -m pipeline sync --dry-run --no-notify` | PASS | run 658fef1c: events_new_violation 0, events_daycare 0, inspections_new 0, join_rate 1.0 (`harness/state/qa/resync-dryrun.log`) | pipeline |
| B4 | Alert for a daycare no longer watched is not shown | `EVENT_ID=43 EVENT_OP=1304920 supabase/snippets/api_smoke.sh` | PASS | hidden before watching → shown while watching (is_replay=true) → hidden after unwatch; 24/24 | platform |
| B5 | RPC latency p95 < 100 ms | `supabase/snippets/bench_rpc.sql` | PASS | search p50 3.3 / p95 24.6 ms, near 6.5 ms, record 1.9 ms (60 runs each, role anon, load avg 7.7 from other terminals) | platform |
| B6 | Push reaches a real iPhone | replay → Expo ticket → receipt → banner | PASS | event 43, ticket 01a17151-582b-75bd-89b2-ccba6e7ae980, receipt delivered_to_provider, owner saw banner 23:31 Oct 24 | pipeline |
| B7 | Push on Android | | CUT | CONTRACT 11:00 pm Oct 24: Android Expo Go has no remote push | |
| B8 | "In TX-04" only on point basis | pgTAP + SQL + source review | PASS | 379 point / 23 county-only in district; every app check is `in_district && district_basis === 'point'` (HomeMap.tsx:66, HomeMap.web.tsx:52, PlacePage.tsx:190); `district_pulse_weekly` and `district_recent_visits` filter `district_basis = 'point'` (pgTAP 004, 008) | platform |
| B9 | Replays are labelled as replays | push body + alert screen | PASS (source) | push body prefix `Replay of a real state record from {date}:` (notify.py:49); alert screen shows "Replay of a real state record" when `is_replay` (alert/[eventId].tsx:69); on-screen check in U21 | pipeline / mobile |

## App (iOS simulator, Expo Go)

| # | Case | Method | Status | Evidence | Owner if it fails |
|---|---|---|---|---|---|
| U1 | First launch: onboarding, then home | Maestro | PASS | `u01-first-launch.yaml`: welcome → Step 2 of 3 → Use my location → pick → Watch → alerts → "You’re watching." → home (`u01-0..4*.png`) | mobile / design |
| U2 | Location allowed | Maestro + simctl location | FAIL | map centered on Prosper while the list is Plano (D1); "location off" after 5 s (D2) (`D1-map-not-centered.png`, `D2-location-off-label.png`) | mobile |
| U3 | Location denied | Maestro + simctl privacy revoke | PENDING | | mobile |
| U4 | Location outside Texas | Maestro + simctl location | PENDING | | mobile |
| U5 | Offline | manual sim (network off) | PENDING | | mobile |
| U6 | Slow network | manual sim | PENDING | | mobile |
| U7 | Search: name hit | Maestro | PASS | "Viva World" → Viva World School (`u07-name.png`) | mobile |
| U8 | Search: no hit | Maestro | PASS | "zzqxv" → no rows, no crash (`u08-no-hit.png`) | mobile |
| U9 | Search: ZIP | Maestro | PASS | "75087" → Rockwall daycares (`u09-zip.png`) | mobile |
| U10 | Search: city | Maestro | PASS | "Sherman" → Sherman daycares (`u10-city.png`) | mobile |
| U11 | Search: typo | Maestro | PASS | "Lionhart" → Lionheart Children’s Academy (`u11-typo.png`; pgTAP 010) | mobile |
| U12 | Center: aerial imagery shown with attribution | Maestro | PENDING | | design |
| U13 | Home daycare: no street address, no imagery, no house pin | Maestro | PASS | 1490119: no "Imagery", no "Placed from the street address", no street line; DB returns address null + 2-decimal point (pgTAP 011) (`u13-home-0.png`) | design / mobile |
| U14 | Place with 0 findings | Maestro | PENDING | | mobile |
| U15 | Place with many findings | Maestro | PASS | 97587 (220 findings) renders, "See all" works (`u15-many-0.png`) | mobile |
| U16 | Place with approximate geocode | Maestro | FAIL | 98685: approximate caption truncated and overlapping the map legal mark (D4) (`u16-approx-0.png`, `D4-approx-caption.png`); no-point 1120831 renders (`u16-nopoint-0.png`) | mobile |
| U16a | Place with 0 / 1 / 3 street photos | Maestro (after pipeline fills photos) | PENDING | | mobile |
| U16b | Home daycare never shows photos | pgTAP 009 + Maestro | PASS (SQL) | `daycare_record` returns `photos: []` for a home even when a row exists (pgTAP 009); on-screen check pending | platform / mobile |
| U16c | Approximate geocode never shows photos | pgTAP 009 + Maestro | PASS (SQL) | `photos: []` for a non_exact center even when a row exists (pgTAP 009); on-screen check pending | platform / mobile |
| U16d | Photo credit (Mapillary, CC BY-SA) and captured date visible | Maestro | PENDING | | mobile / design |
| U17 | Fix-status strings follow CONTRACT 3 (never "Fixed <corrected_date>") | Maestro + text search | PASS | 1459611 shows "Fix due Oct 30", never "Fixed … Oct 30" (`u17-viva-0.png`) | mobile / design |
| U18 | Watch, unwatch, re-watch | Maestro | PENDING | | mobile |
| U19 | Notifications allowed | Maestro | PENDING | | mobile |
| U20 | Notifications denied | Maestro | PENDING | | mobile |
| U21 | Push tap, app cold | simctl push + Maestro | PENDING | | mobile |
| U22 | Push tap, app warm | simctl push + Maestro | PENDING | | mobile |
| U23 | Push tap, app in background | simctl push + Maestro | PENDING | | mobile |
| U24 | Share | Maestro | PENDING | | mobile |
| U25 | Rights request generation | Maestro | PENDING | | mobile |
| U26 | Tour questions | Maestro | PENDING | | mobile |
| U27 | "View on the state's site" from a finding and from the place page | Maestro | PASS (place) | place page "State record" visible (`u14-place.yaml`); from a finding: pending | mobile |
| U28 | Dark mode | Maestro + simctl appearance | PENDING | | design |
| U29 | Dynamic Type XXXL | Maestro + simctl content_size | PENDING | | design |
| U30 | VoiceOver label on every control | accessibility tree audit | PENDING | | mobile |
| U31 | Wording: never safe / unsafe / score / grade / rank | text search of screens and source | PASS (source) | grep of `apps/mobile/src` for safe/unsafe/score/grade/rank/rating: only code identifiers, "never a score" comments, and the state’s own standard title "Report Unsafe Facility Occurrence" (verbatim); on-screen pass pending | mobile / design |

## Motion (owner rules, OVERNIGHT.md 01:58 / 02:02)

| # | Case | Method | Status | Evidence | Owner if it fails |
|---|---|---|---|---|---|
| M1 | No overshoot or bounce anywhere (springs critically damped, overshootClamping) | source grep of `withSpring`/`spring` configs + screen recording | FAIL | springs in `theme/tokens.ts` all overshootClamping (PASS), but Watch confirm scales to 1.05 (D6) and visit dots ZoomIn from 0 (D7); recording pending | mobile / design |
| M2 | Durations 150–250 ms (sheet excepted); press = 0.98 scale + 0.9 opacity only | source grep of `duration`/`withTiming` + recording | FAIL | NumberCard ring 700 ms (D8); AlertBanner and RecordStrip 260 ms (just over 250, under the 300 ceiling); press 0.98/0.9 in DaycareCard, Chrome, Button (PASS) | mobile / design |
| M3 | Lists animate only on first load (max 3 staggered, 30 ms); no re-animation on refresh or scroll | Maestro pull-to-refresh + recording | PENDING | | mobile |
| M4 | Reduce Motion on: movement replaced by fades | simctl Reduce Motion + recording | PENDING | | mobile |
| M5 | Done screen: one check draw ≤ 400 ms + success haptic, no confetti/particles/pulsing | source + recording | PASS (source) | `Celebration.tsx`: badge fade 200 ms + check wipe 350 ms + success haptic; no confetti/particles/pulse; recording pending | design |
| M6 | Never two things animating for attention on one screen | recording of each screen | PENDING | | design |

## Web link

| # | Case | Method | Status | Evidence | Owner if it fails |
|---|---|---|---|---|---|
| W1 | Search, desktop width (1440 px) | Chrome | PENDING | | pipeline |
| W2 | Place page, desktop width | Chrome | PENDING | | pipeline |
| W3 | Rights, desktop width | Chrome | PENDING | | pipeline |
| W4 | Search, place, rights at phone width (390 px) | Chrome | PENDING | | pipeline |
| W5 | No anonymous sign-in on web | Chrome network log (no `/auth/v1/signup`) | PENDING | | pipeline |

## Failures filed

| # | Row | Filed to | When | Screenshot | Severity · lens · status |
|---|---|---|---|---|---|
| D1 | U2 | mobile | 01:34 Oct 25 | `harness/state/qa/D1-map-not-centered.png` | High · parent lens · mobile fixing |
| D2 | U2 | mobile | 01:34 Oct 25 | `harness/state/qa/D2-location-off-label.png` | Med · bad-day lens · mobile fixing |
| D3 | U13 | design | 01:46 Oct 25 | `harness/state/qa/D3-home-circle-centered.png` | WITHDRAWN: circle snaps to a 0.005° grid, 282 m off the house; DB now also rounds home points |
| D4 | U16 | design | 01:46 Oct 25 | `harness/state/qa/D4-approx-caption.png` | Med · Apple-designer lens · design fixing |
| D5 | U12 | design | 01:46 Oct 25 | | Low · Apple-engineer lens: Esri credit shows over a blank hero before tiles load |
| D6 | M1 | mobile + design | 01:52 Oct 25 | `PlacePage.tsx:144` | Med · Apple-designer lens: Watch confirm pops to 1.05 |
| D7 | M1, M2 | mobile + design | 01:52 Oct 25 | `RecordStrip.tsx:237` | Med · Apple-designer lens: ZoomIn over up to 20 dots (~960 ms) |
| D8 | M2 | mobile + design | 01:52 Oct 25 | `NumberCard.tsx:78` | Low · Apple-designer lens: 700 ms ring fill |
