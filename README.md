# Daycare Watch

**What Texas state inspectors found at your child's daycare, in plain English, with an alert when the state posts something new.**

Texas inspects every licensed daycare and publishes every finding, but the records sit in a state search site that few parents ever open. Daycare Watch reads the state's own open data every day. It shows each finding with its date, how serious the state rates the rule, and whether the fix was verified. It sends a push alert when the state posts a new finding at a daycare a parent is watching. It also turns the rights Texas parents already have under the **Kairo and the Kids' Law** (SB 1098, 88th Legislature, 2023) into ready-to-send requests.

Built for the **2026 Congressional App Challenge, Texas's 4th District**. Rep. Pat Fallon (TX-04) introduced the federal **Kairo Act of 2025 (H.R. 2425)**, which would give parents a similar bill of rights at federally funded child care. It is not law yet. The Texas law it closely tracks already is.

> The app never calls a daycare safe or unsafe, and never scores, grades, or ranks one. It shows what the state found, when, and whether the state verified the fix.

| | |
|---|---|
| **Daycares in TX-04** | **At least 379** active daycares sit inside the district by map point (PostGIS point-in-polygon against the Census CD119 boundary, spot-checked 10/10 against Census TIGERweb) |
| **Statewide records loaded** | 14,310 daycares · 157,358 state visits · 118,294 findings, about 5 years of history |
| **Freshness** | Synced daily from data.texas.gov. Every data screen shows "Last checked with the state" |
| **Platforms** | iPhone and Android from one TypeScript codebase |

---

## How a parent uses it

```mermaid
flowchart LR
  A["1 · Find<br/>Map and search near home<br/>or inside TX-04"] --> B["2 · Read<br/>Every state finding in plain English<br/>with the inspector's own words"]
  B --> C["3 · Watch<br/>'My kid goes here'<br/>turns on push alerts"]
  C --> D["4 · Act<br/>Records and visit requests under SB 1098<br/>Tour questions from this daycare's record<br/>Official report channels"]
```

| Step | What the parent sees | What changes for the parent |
|---|---|---|
| **Find** | Daycares on a map with the last state visit and a 24-month record strip. No grade, no color verdict on a daycare | Finds the record for a daycare they are considering or already use |
| **Read** | Each finding: date · the state's rule risk level (High to Low) · category · fix status · a one-line plain summary · the inspector's words · a link to the official state record. Area comparison against the median for the same type of daycare in the same county | Understands what happened and whether it was fixed |
| **Watch** | One tap. A push alert when the state posts a new finding, a license status change, or a corrective or adverse action | Hears about new state findings without checking a website |
| **Act** | Ready-to-send requests quoting HRC §42.04271 (drop-in during open hours, records and inspection reports, video only after an alleged abuse or neglect incident involving their child). Tour questions built from that daycare's own findings. Verified state report channels | Uses rights that already exist in Texas law |

## Screenshots

Screens are captured from the running app on real state data. See [`docs/screenshots/`](docs/screenshots/).

## Architecture

```mermaid
flowchart TB
  subgraph TX["data.texas.gov · Texas HHSC Child Care Regulation (SODA API)"]
    OPS["Operations · bc5r-88dy<br/>row-level daily updates"]
    ACT["Inspections · m5q4-3y3d<br/>full nightly reload"]
    VIO["Violations · tqgd-mf4x<br/>full nightly reload"]
  end
  CEN["U.S. Census Geocoder<br/>batch API"]
  TIG["Census TIGER CD119<br/>TX-04 boundary"]

  subgraph PIPE["Pipeline · Python 3.12 · daily GitHub Action"]
    P["extract → validate → stage → transform → diff →<br/>geocode → district → classify → aggregate → notify → log"]
  end

  subgraph DB["Supabase · Postgres + PostGIS"]
    CORE["core.* public records"]
    APP["app.* watches, devices<br/>row-level security"]
    RPC["RPC functions<br/>the only client API"]
  end

  PUSH["Expo Push → APNs / FCM"]
  MOB["Mobile app · Expo React Native · TypeScript<br/>iPhone + Android"]

  OPS & ACT & VIO --> P
  CEN --> P
  TIG --> P
  P -- "psycopg COPY + SQL upserts" --> CORE
  P -- "new state finding × watchers" --> PUSH
  PUSH --> MOB
  MOB -- "HTTPS · anonymous sign-in" --> RPC
  RPC --> CORE
  RPC --> APP
```

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo (React Native), TypeScript strict, Expo Router, TanStack Query, react-native-maps, expo-notifications | One codebase for iPhone and Android. Maps need no API key on iOS |
| Database | Supabase Postgres + PostGIS, row-level security, RPC functions, materialized views | The product is joins, geography (point-in-polygon, nearest daycares), and medians, all native in SQL |
| Pipeline | Python 3.12, httpx, pydantic v2, psycopg 3 (COPY), structlog | Daily full-table diffs of 200k+ rows with a real test suite |
| Push | Expo Push API with receipts | One API for both platforms. Tokens Apple or Google reject are disabled |
| Types | `supabase gen types typescript` → `packages/db/types.ts` | The app's types come from the real schema, so they cannot drift |

### The daily pipeline

```mermaid
flowchart LR
  E[Extract<br/>SODA, paged, retries] --> V[Validate<br/>pydantic data contract]
  V --> S[Stage<br/>COPY into staging.*]
  S --> T[Transform<br/>upsert core.*<br/>join rate ≥ 95% or fail]
  T --> D[Diff<br/>by id + row hash<br/>→ change_events]
  D --> G[Geocode<br/>Census batch,<br/>cached by address]
  G --> R[District<br/>ST_Covers vs CD119]
  R --> C[Classify<br/>deterministic rules<br/>+ plain summary]
  C --> A[Aggregate<br/>refresh matviews]
  A --> N[Notify<br/>Expo Push,<br/>dedupe per user+event]
  N --> L[Log<br/>ops.sync_runs]
```

| Stage | Guarantee | Tested by |
|---|---|---|
| Validate | Unknown risk levels, bad dates, or missing fields fail the run | Contract tests on real captured records |
| Transform | Violations must join to their inspection at ≥ 95% or the run fails (measured: 100%) | `test_load.py` |
| Diff | Re-running a sync creates 0 new events | Idempotency test |
| Classify | Every finding gets one of 9 categories from fixed rules on the state's standard number. The plain summary never adds facts | `test_classify.py`, 100% coverage |
| Notify | One push per user per event. A replay of a real past finding is labeled "Replay of a real state record from <date>" | `test_notify.py` round trip with receipts |

## The data

| Dataset | ID | How the state updates it | How we sync it |
|---|---|---|---|
| Operations (daycares) | `bc5r-88dy` | Row-level, about 300 to 450 rows a day statewide | Incremental by `:updated_at`, plus a weekly full reconcile |
| Activities (inspections) | `m5q4-3y3d` | Full reload nightly, about 205,000 rows | Full download, diff by `activity_id` + row hash |
| Violations (findings) | `tqgd-mf4x` | Full reload nightly, about 134,000 rows | Full download, diff by `non_compliance_id` + row hash |

**Measured on Oct 24 2026:**

| Fact | Number |
|---|---|
| In-scope daycares statewide (licensed centers, licensed and registered child-care homes, listed family homes) | 14,310 |
| State visits loaded | 157,358 |
| Findings loaded | 118,294 |
| Daycares with a map point | 13,024 (577 from state coordinates, 12,447 from the Census Geocoder) |
| Census match quality | 10,991 exact · 1,456 non-exact (address matched with corrections) |
| Active daycares inside TX-04 by map point | at least 379 (330 exact, 28 non-exact, 21 state coordinates). 23 more fall back to county only and are never labeled TX-04 |
| RPC latency, p95 on the full dataset | nearest daycares 7.5 ms · search 30 ms · daycare record 1 ms |

### Data model

| Table | Key | What it holds |
|---|---|---|
| `core.daycares` | `operation_id` | Name, type, address, capacity, ages, hours, permit flags, `geom`, `geocode_source` (state or census), `geocode_quality`, `in_district`, `district_basis` (point or county) |
| `core.inspections` | `activity_id` | Visit date, type, whether violations were found |
| `core.violations` | `non_compliance_id` | Date, standard, state risk level, category, plain summary, inspector narrative, correction and verification dates |
| `core.change_events` | `id` | `new_violation`, `status_change`, `corrective_action`, `adverse_action`, `closure`, `capacity_change`, `permit_conditions`, with before and after values and an `is_replay` flag |
| `app.watches` | `(user_id, operation_id)` | Which daycares a parent watches. Row-level security: owner only |
| `app.devices` | push token | Expo push token and platform. Owner only |
| `app.notifications` | `(user_id, event_id)` | Dedupe key, Expo ticket and receipt status |
| `geo.districts` | `id` | The TX-04 (CD119) polygon |
| `ops.sync_runs` | `run_id` | Per-stage counts, join rate, newest source date, ok or error |

Clients never touch tables. They call 11 RPC functions (`daycares_near`, `daycare_search`, `daycare_record`, `area_compare`, `watch`, `unwatch`, `my_watches`, `alert_detail`, `register_device`, `last_sync`, `district_pulse`). Each is `security definer` with an empty `search_path`.

## Honesty and privacy rules

These rules are enforced in code and tests, not just in copy review.

| Rule | Why |
|---|---|
| No scores, grades, rankings, or safe/unsafe labels. Color marks the state's risk level of one finding, never a daycare | A count of findings is not a verdict, and the state does not publish one |
| "Fixed" means the state verified it. The state's `corrected_date` is shown as a due or listed date | 124 findings carry a `corrected_date` in the future, so it behaves like a deadline |
| A daycare is labeled "in TX-04" only when its map point is inside the district | The state's county field can be wrong, and most of Collin and Denton counties are outside TX-04 |
| Home daycares (4,705 statewide) get no aerial imagery, no map of the house, and no street address on the place page: city and ZIP only, with the full record one tap away on the state's site | They are private residences, often listed under a person's name, and a street-range geocode can land on the wrong house |
| Map links send the state's address line, not our geocoded point | The geocode is an estimate |
| Kids' Law request cards are hidden for listed family homes | HRC §42.04271(a) does not cover them |
| The app never claims to alert when an investigation opens, and never claims to be the only way to get updates | Findings appear only after state due process, and the state already offers email updates per daycare |
| No made-up data anywhere, including tests | Every fixture is a real captured state record |

## Legal and official sources

Every phone number, URL, and legal line in the app traces to a row in [`docs/OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md). Each row was checked against the live official page and quotes it verbatim.

| Source | Used for |
|---|---|
| Texas HRC §42.04271, enacted by 88(R) SB 1098, the Kairo and the Kids' Law (effective Sep 1 2023) | Drop-in, records, inspection reports, and the narrow video right |
| H.R. 2425, Kairo Act of 2025 (Rep. Fallon, introduced Mar 27 2025, in committee) | Context only. Never presented as law |
| 26 TAC ch. 746 (Minimum Standards for Child-Care Centers) | Parent rights centers must post and follow |
| Texas Abuse Hotline 1-800-252-5400 · 911 · HHSC Child Care Regulation report form | Report-a-concern channels |
| HHSC Child Care Regulation Handbook | Plain-English meaning of corrective action, adverse action, and permit conditions |

## Tests

| Suite | Count | Command |
|---|---|---|
| Database (pgTAP): schema, row-level security allow and deny, every RPC, views, visits, geocode quality | 134 tests in 6 files | `supabase test db` |
| Pipeline (pytest, plus hypothesis property tests) | 217 tests, 93% coverage | `cd services/pipeline && uv run pytest` |
| Pipeline static checks | ruff + `mypy --strict` clean | `uv run ruff check . && uv run mypy --strict src` |
| Mobile unit tests (Jest) | 22 tests | `cd apps/mobile && npx jest` |
| Mobile end-to-end (Maestro) | 11 flows: home, record, watch, alert tap, reload alert, tour, dialogs, accessibility at the largest text size, full find-to-alert journey | `maestro test apps/mobile/e2e/journey-find-watch.yaml` |
| Mobile static checks | `tsc --noEmit`, ESLint, expo-doctor | `npm run typecheck --prefix apps/mobile` |

GitHub Actions runs the pipeline checks on every push (`pipeline-ci.yml`) and the daily sync at 10:15 UTC (`daily-sync.yml`), about an hour after the state's nightly reload.

## Getting started

Requirements: Node 20+, Python 3.12 with [uv](https://docs.astral.sh/uv/), the Supabase CLI, and Docker.

```bash
# 1. Database: Postgres + PostGIS with every migration applied
supabase start
supabase test db

# 2. Data: load the real state records (about 1 minute)
cd services/pipeline
uv sync
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres uv run python -m pipeline backfill
cd ../..

# 3. App
npm install
echo "EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321" >  apps/mobile/.env.local
echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from: supabase status>" >> apps/mobile/.env.local
cd apps/mobile && npx expo start
```

On a real phone, use the computer's LAN address in `EXPO_PUBLIC_SUPABASE_URL` instead of `127.0.0.1`.

Pipeline commands: `python -m pipeline sync` (daily), `backfill` (history, no alerts), `sync --replay <non_compliance_id>` (re-send a real past finding as a labeled replay), `report`, `receipts`.

## Repository layout

| Path | What |
|---|---|
| `apps/mobile` | The parent app (Expo, iOS and Android) |
| `services/pipeline` | Daily data pipeline and its tests |
| `supabase/migrations` | Schema, row-level security, RPC functions, views |
| `supabase/tests` | pgTAP database tests |
| `packages/db` | Database types generated from the schema |
| `docs/ARCHITECTURE.md` | System design and measured data |
| `docs/OFFICIAL_SOURCES.md` | Every legal claim, phone number, and URL, with a verbatim source quote |
| `.github/workflows` | Pipeline CI and the daily sync |

## Known limits

- Findings appear only after the daycare has had due process. Alerts can arrive days to weeks after a visit.
- 1,286 in-scope daycares have no map point (no state coordinates and no Census match). They stay findable by search.
- Census matches place an address along its street range, not on the rooftop.
- Remote push on Android requires a standalone build. The Expo Go test app can show records on Android but cannot receive pushes.
