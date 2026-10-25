# Daycare Watch: how it works

## 1. The parent's workflow

```
 ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
 │ 1. FIND      │──▶│ 2. READ          │──▶│ 3. WATCH         │──▶│ 4. ACT           │
 │ Map + search │   │ The state record │   │ "My kid goes     │   │ Rights request   │
 │ near me / in │   │ in plain English │   │  here" → push    │   │ Tour questions   │
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
              │ PIPELINE (Python 3.12, runs daily 10:15 UTC)       │
              │ extract → validate → stage → transform → diff →    │
              │ classify → aggregate → notify → log                │
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

**Distribution:** the Congressional App Challenge rules allow any platform. Nothing has to be on the App Store or Google Play. Judges watch the video and may ask for the code. Use EAS builds to put it on real parents' phones: TestFlight on iPhone (external testers need a short beta review, so submit by Sunday morning) and an internal-testing or APK build on Android.

## 4. The data, measured (Oct 24 2026)

| Fact | Number | What it means for the app |
|---|---|---|
| Daycares in the 12 counties CD119 touches (all types, active) | 1,527 (919 licensed centers, 135,630 spots). **County count, not district count**: Collin + Denton are 83% of it but mostly outside TX-04 | Every one has a record on day one (≈5-year backfill). The in-district number comes from geocoding + point-in-polygon |
| State visits in those counties (county-based, re-measure in district), last 13 weeks | 1,211 visits to 655 different daycares (≈ 90/week) | The district feed is never quiet |
| Visits that found violations | 258 (≈ 20–39/week in settled weeks) | About 25 real, new findings a week to alert on and to show |
| Per-daycare visit gap | every 2–8 months | Alerts are rare for any one family, like a smoke alarm. That's correct, not a weakness. |
| Recent weeks with violations flagged | wk 41: 8, wk 42: 2, wk 43: 0 | Findings seem to be finalized 1–3 weeks after the visit (**inference, verify**). Alerts arrive days to weeks after an inspection. |
| Statewide table sizes | activities 205,457 rows · violations 133,739 rows | Small for Postgres. A full nightly download and diff is cheap. |
| How the state publishes | operations: row-level `:updated_at` changes (≈ 300–450 rows/day) · activities and violations: full reload nightly ≈ 09:00 UTC | Operations sync incrementally by watermark. Activities and violations sync by full download and ID/hash diff. |

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
| 7 | **Aggregate** | `REFRESH MATERIALIZED VIEW` for area medians, district totals, and the weekly pulse | Totals reconcile with core |
| 8 | **Notify** | Events × watchers → Expo Push API (batched, with receipts checked; dead tokens pruned). Dedupe key per (user, event). Replay mode labelled "replaying a real state record from <date>". | A real push on an iPhone (verified Oct 24 2026: replay event 43, receipt delivered_to_provider). Android push needs a standalone build |
| 9 | **Log** | `ops.sync_runs`: counts per stage, newest source date, join rate, duration, error | The app shows "Last checked with the state" |

## 6. Database (core tables)

| Table | Key | Notable columns |
|---|---|---|
| `core.daycares` | operation_id | name, type, address, city, county, zip, `geom geography(Point)` (state coords, else Census geocode), `geocode_source`, `geocode_quality` (exact/non_exact), capacity, ages[], hours, subsidies, status, corrective/adverse/closed flags, `in_district`, `district_basis` (point/county) |
| `core.inspections` | activity_id | operation_id, date, type, violation_found, self_report |
| `core.violations` | non_compliance_id | activity_id, operation_id, date, standard, risk_level, category, plain, narrative, corrected_at_inspection, corrected_date, verified_date, via_investigation |
| `core.change_events` | id | operation_id, kind (`new_violation`/`status_change`/`corrective_action`/`adverse_action`/`closure`/`capacity_change`/`permit_conditions`), ref_id, before/after jsonb, `is_replay`, detected_at |
| `app.watches` | (user_id, operation_id) | created_at. RLS: owner only. |
| `app.devices` | push_token | user_id, platform (ios/android), expo_push_token, last_seen. RLS: owner only. |
| `app.notifications` | (user_id, event_id) | sent_at, ticket_id, receipt_status |
| `geo.districts` | id | TX-04 polygon (Census TIGER CD119) |
| `ops.sync_runs` | run_id | stage counts, join rate, newest source date, ok, error |

The app calls only the RPC functions pinned in CONTRACT.md section 4.1 (`daycares_near`, `daycare_record`, `area_compare`, `district_pulse`, `alert_detail`, …). It never touches raw tables. `core.*` is read-only to clients, and `app.*` is guarded by row-level security.

## 7. Guardrails
- It never says safe, unsafe, a score, or a grade. It shows what the state found, when, and whether it was fixed.
- No made-up data anywhere. Test fixtures are real captured records.
- It never claims to alert when an investigation *opens*. Findings appear only once the state posts them.
- Every screen with data shows "Last checked with the state: <time>".
