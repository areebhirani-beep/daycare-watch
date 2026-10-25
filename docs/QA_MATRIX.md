# QA matrix

Every user case, how it is tested, and the result. Owner: platform (QA lead).
Rows are tested cold, by someone who did not write the UI.

**Status:** PASS · FAIL (filed to the owner) · PENDING (not run yet) · CUT (out of scope by CONTRACT decision)
**Where:** UI rows run on the iPhone 17 Pro Max simulator in Expo Go against the local stack (same data as cloud). Flows are in `apps/mobile/e2e/qa/`, screenshots in `harness/state/qa/`.

## Backend and data

| # | Case | Method | Status | Evidence | Owner if it fails |
|---|---|---|---|---|---|
| B1 | Schema, RLS allow + deny, RPC shapes, views, photos rule, recent visits | pgTAP | PASS | `supabase test db` → Files=9, Tests=158, PASS | platform |
| B2 | App API path: public reads, anonymous sign-in, watch / unwatch / re-watch idempotent, `core`/`app`/`ops` tables unreachable | `supabase/snippets/api_smoke.sh` | PASS | local 21/21; cloud `yqrrfawmsvhxgffgrmse` 21/21 | platform |
| B3 | Daily sync on a no-change night creates no events | `python -m pipeline sync --dry-run --no-notify` | PASS | run 658fef1c: events_new_violation 0, events_daycare 0, inspections_new 0, join_rate 1.0 (`harness/state/qa/resync-dryrun.log`) | pipeline |
| B4 | Alert for a daycare no longer watched is not shown | `EVENT_ID=43 EVENT_OP=1304920 supabase/snippets/api_smoke.sh` | PASS | hidden before watching → shown while watching (is_replay=true) → hidden after unwatch; 24/24 | platform |
| B5 | RPC latency p95 < 100 ms | `supabase/snippets/bench_rpc.sql` | PASS | search 29.9 ms, near 7.5 ms, record 1.0 ms (60 runs each, role anon) | platform |
| B6 | Push reaches a real iPhone | replay → Expo ticket → receipt → banner | PASS | event 43, ticket 01a17151-582b-75bd-89b2-ccba6e7ae980, receipt delivered_to_provider, owner saw banner 23:31 Oct 24 | pipeline |
| B7 | Push on Android | | CUT | CONTRACT 11:00 pm Oct 24: Android Expo Go has no remote push | |
| B8 | "In TX-04" only on point basis | pgTAP + SQL + source review | PASS | 379 point / 23 county-only in district; every app check is `in_district && district_basis === 'point'` (HomeMap.tsx:66, HomeMap.web.tsx:52, PlacePage.tsx:190); `district_pulse_weekly` and `district_recent_visits` filter `district_basis = 'point'` (pgTAP 004, 008) | platform |
| B9 | Replays are labelled as replays | push body + alert screen | PASS (source) | push body prefix `Replay of a real state record from {date}:` (notify.py:49); alert screen shows "Replay of a real state record" when `is_replay` (alert/[eventId].tsx:69); on-screen check in U21 | pipeline / mobile |

## App (iOS simulator, Expo Go)

| # | Case | Method | Status | Evidence | Owner if it fails |
|---|---|---|---|---|---|
| U1 | First launch: onboarding, then home | Maestro | PENDING | | mobile / design |
| U2 | Location allowed | Maestro + simctl location | PENDING | | mobile |
| U3 | Location denied | Maestro + simctl privacy revoke | PENDING | | mobile |
| U4 | Location outside Texas | Maestro + simctl location | PENDING | | mobile |
| U5 | Offline | manual sim (network off) | PENDING | | mobile |
| U6 | Slow network | manual sim | PENDING | | mobile |
| U7 | Search: name hit | Maestro | PENDING | | mobile |
| U8 | Search: no hit | Maestro | PENDING | | mobile |
| U9 | Search: ZIP | Maestro | PENDING | | mobile |
| U10 | Search: city | Maestro | PENDING | | mobile |
| U11 | Search: typo | Maestro | PENDING | | mobile |
| U12 | Center: aerial imagery shown with attribution | Maestro | PENDING | | design |
| U13 | Home daycare: no street address, no imagery, no house pin | Maestro | PENDING | | design / mobile |
| U14 | Place with 0 findings | Maestro | PENDING | | mobile |
| U15 | Place with many findings | Maestro | PENDING | | mobile |
| U16 | Place with approximate geocode | Maestro | PENDING | | mobile |
| U16a | Place with 0 / 1 / 3 street photos | Maestro (after pipeline fills photos) | PENDING | | mobile |
| U16b | Home daycare never shows photos | pgTAP 009 + Maestro | PASS (SQL) | `daycare_record` returns `photos: []` for a home even when a row exists (pgTAP 009); on-screen check pending | platform / mobile |
| U16c | Approximate geocode never shows photos | pgTAP 009 + Maestro | PASS (SQL) | `photos: []` for a non_exact center even when a row exists (pgTAP 009); on-screen check pending | platform / mobile |
| U16d | Photo credit (Mapillary, CC BY-SA) and captured date visible | Maestro | PENDING | | mobile / design |
| U17 | Fix-status strings follow CONTRACT 3 (never "Fixed <corrected_date>") | Maestro + text search | PENDING | | mobile / design |
| U18 | Watch, unwatch, re-watch | Maestro | PENDING | | mobile |
| U19 | Notifications allowed | Maestro | PENDING | | mobile |
| U20 | Notifications denied | Maestro | PENDING | | mobile |
| U21 | Push tap, app cold | simctl push + Maestro | PENDING | | mobile |
| U22 | Push tap, app warm | simctl push + Maestro | PENDING | | mobile |
| U23 | Push tap, app in background | simctl push + Maestro | PENDING | | mobile |
| U24 | Share | Maestro | PENDING | | mobile |
| U25 | Rights request generation | Maestro | PENDING | | mobile |
| U26 | Tour questions | Maestro | PENDING | | mobile |
| U27 | "View on the state's site" from a finding and from the place page | Maestro | PENDING | | mobile |
| U28 | Dark mode | Maestro + simctl appearance | PENDING | | design |
| U29 | Dynamic Type XXXL | Maestro + simctl content_size | PENDING | | design |
| U30 | VoiceOver label on every control | accessibility tree audit | PENDING | | mobile |
| U31 | Wording: never safe / unsafe / score / grade / rank | text search of screens and source | PENDING | | mobile / design |

## Web link

| # | Case | Method | Status | Evidence | Owner if it fails |
|---|---|---|---|---|---|
| W1 | Search, desktop width (1440 px) | Chrome | PENDING | | pipeline |
| W2 | Place page, desktop width | Chrome | PENDING | | pipeline |
| W3 | Rights, desktop width | Chrome | PENDING | | pipeline |
| W4 | Search, place, rights at phone width (390 px) | Chrome | PENDING | | pipeline |
| W5 | No anonymous sign-in on web | Chrome network log (no `/auth/v1/signup`) | PENDING | | pipeline |

## Failures filed

| # | Row | Filed to | When | Screenshot | Status |
|---|---|---|---|---|---|
