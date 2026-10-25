# Daycare Watch: how it works

## 1. The parent's workflow

```
 ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
 │ 1. FIND      │──▶│ 2. READ          │──▶│ 3. WATCH         │──▶│ 4. ACT           │
 │ Map + search │   │ The state record │   │ "Watch this      │   │ Rights request   │
 │ near me / in │   │ in plain English │   │  daycare" → push │   │ Tour questions   │
 │ the district │   │ + inspector note │   │  alerts on new   │   │ Report a concern │
 └──────────────┘   └──────────────────┘   │  state findings  │   └──────────────────┘
                                           └──────────────────┘
```

| Step | What the parent sees | What the parent does next |
|---|---|---|
| **Find** | Daycares on a map, each with its last inspection date and recent findings count. Never a grade. | Taps one |
| **Read** | Every state finding over about 5 years: date · seriousness · category · fixed or not, with the fix date · a one-line plain summary · the inspector's own words · a comparison to the area · a link to the official record | Decides whether to tour or enroll |
| **Watch** | One tap → push alerts when the state posts a new finding, a license status change, or a corrective or adverse action at that daycare | Gets told within days of the state posting, not never |
| **Act** | Kairo and the Kids' Law (SB 1098) rights card → a ready-to-send request for records, video, or a visit. Tour questions built from *that* daycare's own record. Official state complaint channels. | Uses rights that already exist in law |

## 2. The system

```
  data.texas.gov (Texas HHSC Child Care Regulation)     Expo Push → APNs / FCM
  ┌──────────────────────────────────────────────┐         ┌──────────┐
  │ operations  bc5r-88dy  (row-level updates)   │         │ Expo Push│
  │ activities  m5q4-3y3d  (full daily refresh)  │         └────▲─────┘
  │ violations  tqgd-mf4x  (full daily refresh)  │              │ push
  │ investig.   txmx-ceda  (county totals)       │              │
  └───────────────────┬──────────────────────────┘              │
                      │ SODA API, nightly ~09:00 UTC             │
              ┌───────▼────────────────────────────────────────┴──┐
              │ PIPELINE (Python 3.12, daily 10:15 + 11:47 UTC)    │
              │ extract → validate → stage → transform → diff →    │
              │ classify → district → aggregate → notify → photos  │
              └───────┬────────────────────────────────────────────┘
                      │ SQL (psycopg, COPY)
              ┌───────▼───────────────────────────────┐
              │ POSTGRES 17 + PostGIS  (Supabase)     │
              │ core tables · change_events · RLS ·   │
              │ RPC functions · materialized views    │
              └───────▲───────────────────────────────┘
                      │ HTTPS (PostgREST + RPC), anonymous auth → optional Apple/Google sign-in
              ┌───────┴────────────────────────────────────────┐
              │ MOBILE APP (React Native + Expo, TypeScript)   │
              │ one codebase → iPhone + Android                │
              └────────────────────────────────────────────────┘
```

## 3. Why this stack

| Choice | Over | Why |
|---|---|---|
| **Postgres + PostGIS** (Supabase, free tier) | Firebase/Firestore | The whole product is joins (violation → inspection → daycare), geography (point-in-polygon for TX-04, nearest-N daycares), aggregates (area medians, district totals), and full-text search over inspector notes. Postgres does all of these natively in SQL. Firestore does none of them well. |
| **React Native + Expo (SDK latest), TypeScript strict** | Swift only / web app | One codebase for iPhone **and** Android. About 4 in 10 US phones are Android, and a parent app that skips them cuts its reach. react-native-maps (Apple Maps on iPhone with no API key, Google Maps on Android), which also runs inside the Expo Go test app; real push through Expo Push (APNs + FCM); EAS builds for an installable iPhone build. |
| **Expo Push** | Raw APNs + FCM | One API for both platforms, with receipts. Android push needs an FCM credential under the hood, used only as a transport, with no Firebase database. |
| **Generated types** | Hand-written types | `supabase gen types typescript` produces the app's types from the real schema, so the app and the database can't drift apart. |
| **Python pipeline** | Edge functions | Daily full-table diffs of 200k+ rows need COPY, a real test suite, and no 150-second timeout. It runs locally and on a schedule. |
| **Official API** | A scraper | The SODA API is documented, stable, and legal to use. A scraper breaks when the page changes. Scraping is a fallback only if a field we need exists only on the public site, and none does today. |

**Distribution:** the Congressional App Challenge rules allow any platform. Nothing has to be on the App Store or Google Play. Judges watch the video and may ask for the code. The app is tested on a physical iPhone; Android runs from the same code, and Android push needs a standalone build.

## 4. The data, measured (Oct 24 to 25 2026)

Every number below is inside TX-04 by map point (PostGIS point-in-polygon against the Census CD119 boundary), not by county. The full tables are in the [README](../README.md#the-data).

| Fact | Number | What it means for the app |
|---|---|---|
| Active daycares inside TX-04 | **At least 379** (330 exact Census match, 28 non-exact, 21 state coordinates). 23 more fall back to county only and are never labelled TX-04 | Every one has about 5 years of record on day one |
| State activities at those daycares, 13 complete weeks (Jul 20 to Oct 18 2026) | 284 at 158 daycares, about 22 a week | The district feed is never quiet |
| Activities that found violations | 65, with another 23 still "Pending" | Findings are posted after the visit, so alerts arrive days to weeks after an inspection, never when an investigation opens |
| Findings posted in those 13 weeks | 135 (31 under High-risk rules) | About 10 new findings a week across the district to alert on |
| Time between inspections at one daycare | Median 66 days, 90th percentile 330 days | Alerts are rare for any one family, like a smoke alarm. That is correct, not a weakness |
| Statewide table sizes | activities about 205,000 rows · violations about 134,000 rows | Small for Postgres. A full nightly download and diff is cheap |
| How the state publishes | operations: row-level `:updated_at` changes (about 300 to 450 rows a day) · activities and violations: full reload nightly, about 09:00 UTC | Operations sync incrementally by watermark. Activities and violations sync by full download and ID + row-hash diff |
| TX-04 Licensed Centers with a hand-checked street photo | 1 of 209 with an exact address match. 80 have any Mapillary image within 60 m of the building; all 107 facing it were checked by eye | Rules alone picked the wrong building 3 times in 5, because a Census address point sits on the street, not the building. Only checked photos are shown; every place page stands on the map, the 3D view, and the record |

**More signal from the same official source (no scraping):** beyond new violations, the operations table changes daily, so we also alert on license status changes, corrective or adverse action, temporary closure, conditions on the permit, and capacity changes. Every daycare's page also gets an area comparison, and the district gets a weekly "what inspectors found this week" pulse.

## 5. Pipeline stages

| # | Stage | Detail | Test |
|---|---|---|---|
| 1 | **Extract** | SODA paged JSON, or CSV export for full tables; retries with backoff; app token from env | Recorded real responses |
| 2 | **Validate** | Pydantic models = the data contract. Fail on a missing field, a bad date, or an unknown risk level. | Contract tests on real fixtures |
| 3 | **Stage** | `COPY` into `staging.*` tables per run (`run_id`) | Row counts match the source |
| 4 | **Transform** | SQL upserts into `core.*`. Violations joined to activity dates. Corrected/verified dates parsed. `via_investigation` flagged. | Join rate ≥ 95% or the run fails |
| 5 | **Diff** | New `non_compliance_id`s, plus field-level changes on operations, become `change_events` (type, before/after) | Idempotent: a re-run creates 0 new events |
| 6 | **Classify** | Deterministic category rules on the standard number (744.1205 → supervision, 745.6xx → background checks, …). A plain summary from the narrative that never adds facts. | One test per rule, plus a golden file |
| 7 | **Geocode + district** | Census Geocoder for daycares without state coordinates (exact or non-exact match kept). `in_district` set by PostGIS `ST_Covers` against the TX-04 polygon; county is a fallback only and never labelled TX-04 | Real Frisco, Sherman, and Paris daycares inside, real Dallas ones outside |
| 8 | **Aggregate** | `REFRESH MATERIALIZED VIEW` for area medians, district totals, and the weekly pulse | Totals reconcile with core |
| 9 | **Notify** | Events × watchers → Expo Push API (batched, with receipts checked; dead tokens pruned). Dedupe key per (user, event). Replay mode labelled "Replay of a real state record from <date>". | A real push on an iPhone (verified Oct 24 2026: replay event 43, receipt delivered_to_provider). Android push needs a standalone build |
| 10 | **Photos** (hand-checked) | Loads `data/verified_photos.csv`, the photos a person checked show that daycare (at most 2 per center, different drives, within 6 years). No API call; a bad row is reported in the run's counts and never fails the run. Finding candidates to check is a separate command (`photos`, needs `MAPILLARY_TOKEN`) | Recorded real Mapillary answers in `fixtures/mapillary/` |
| 11 | **Log** | `ops.sync_runs`: counts per stage, newest source date, join rate, duration, error | The app shows "Last checked with the state" |

## 6. Database (core tables)

| Table | Key | Notable columns |
|---|---|---|
| `core.daycares` | operation_id | name, type, address, city, county, zip, `geom geography(Point)` (state coords, else Census geocode), `geocode_source`, `geocode_quality` (exact/non_exact), capacity, ages[], hours, subsidies, status, corrective/adverse/closed flags, `in_district`, `district_basis` (point/county) |
| `core.inspections` | activity_id | operation_id, date, type, violation_found, self_report |
| `core.violations` | non_compliance_id | activity_id, operation_id, date, standard, risk_level, category, plain, narrative, corrected_at_inspection, corrected_date, verified_date, via_investigation |
| `core.daycare_photos` | (operation_id, image_id) | captured_at, distance_m, compass_angle, creator, verified, verified_at. Only verified rows are ever returned (`daycare_record`); Licensed Centers with an exact match only |
| `core.change_events` | id | operation_id, kind (`new_violation`/`status_change`/`corrective_action`/`adverse_action`/`closure`/`capacity_change`/`permit_conditions`), ref_id, before/after jsonb, `is_replay`, detected_at |
| `app.watches` | (user_id, operation_id) | created_at. RLS: owner only. |
| `app.devices` | push_token | user_id, platform (ios/android), expo_push_token, last_seen. RLS: owner only. |
| `app.notifications` | (user_id, event_id) | sent_at, ticket_id, receipt_status |
| `geo.districts` | id | TX-04 polygon (Census TIGER CD119) |
| `ops.sync_runs` | run_id | stage counts, join rate, newest source date, ok, error |

The app calls only the RPC functions in [`supabase/migrations/20261024210500_rpc.sql`](../supabase/migrations/20261024210500_rpc.sql) and later migrations (`daycares_near`, `daycare_record`, `area_compare`, `district_pulse`, `alert_detail`, …). It never touches raw tables. `core.*` is read-only to clients, and `app.*` is guarded by row-level security.

## 7. Guardrails
- It never says safe, unsafe, a score, or a grade. It shows what the state found, when, and whether it was fixed.
- No made-up data anywhere. Test fixtures are real captured records.
- It never claims to alert when an investigation *opens*. Findings appear only once the state posts them.
- Every screen with data shows "Last checked with the state: <time>".
