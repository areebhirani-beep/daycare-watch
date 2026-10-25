<div align="center">

# Daycare Watch

**For Texas parents: see what state inspectors found at a daycare, in plain English, and get an alert when the state posts something new.**

[![Pipeline CI](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/pipeline-ci.yml/badge.svg)](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/pipeline-ci.yml)
[![Daily sync](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/daily-sync.yml/badge.svg)](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/daily-sync.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/iPhone-tested%20on%20device-lightgrey.svg)
![Data](https://img.shields.io/badge/data-data.texas.gov-0b6e4f.svg)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/hero-dark.png">
  <img src="docs/screenshots/hero-light.png" alt="Daycare Watch: nearby daycares, a daycare's state record, and the alert for a new state finding" width="100%">
</picture>

Real state records from data.texas.gov only · **at least 379** daycares inside TX-04 · 118,294 findings loaded · push alert delivered to a real iPhone ([replay of a real finding](docs/QA_MATRIX.md))

Built for the **2026 Congressional App Challenge · Texas's 4th District**

</div>

---

## Contents

- [Why](#why) · [How a parent uses it](#how-a-parent-uses-it) · [Screenshots](#screenshots)
- [How it works](#how-it-works) · [The data](#the-data) · [Honesty and privacy](#honesty-and-privacy)
- [Tests](#tests) · [Getting started](#getting-started) · [Project structure](#project-structure) · [Roadmap](#roadmap) · [Docs](#docs)

## Why

- **The gap:** Texas publishes every inspection finding, but in a state search site few parents ever open.
- **What it does:** reads the state's open data every day and shows each finding in plain English: when, how serious the state rates the rule, and whether the state has checked the fix. A push arrives when the state posts something new at a daycare a parent watches.
- **What a parent can do next:** ready-to-send requests under the **Kairo and the Kids' Law** (88(R) SB 1098, 2023), which line up with Rep. Pat Fallon's proposed federal Kairo Act (H.R. 2425, not law).

> The app never calls a daycare safe or unsafe, and never scores, grades, or ranks one. It shows what the state found, when, and whether the state has checked the fix.

| | |
|---|---|
| **Daycares in TX-04** | **At least 379** active daycares inside the district by map point (PostGIS point-in-polygon against the Census CD119 boundary) |
| **State records loaded** | 14,310 daycares · 157,358 state visits · 118,294 findings, about 5 years of history |
| **Freshness** | Synced daily from data.texas.gov. Every data screen shows "Last checked with the state" |
| **Proven end to end** | A real past state finding, replayed as a labelled alert, reached a real iPhone as a push (Expo receipt `delivered_to_provider`) and opened that daycare's record ([QA matrix B6](docs/QA_MATRIX.md)) |
| **Platforms** | iPhone, tested on device. Android runs from the same code; Android push needs a standalone build |

## How a parent uses it

```mermaid
flowchart LR
  A["1 · Find<br/>Map and search near home<br/>or inside TX-04"] --> B["2 · Read<br/>Every state finding in plain English<br/>with the inspector's own words"]
  B --> C["3 · Watch<br/>'Watch this daycare'<br/>turns on push alerts"]
  C --> D["4 · Act<br/>Records and visit requests under SB 1098<br/>Tour questions from this daycare's record<br/>Official report channels"]
```

| Step | What the parent sees | What changes for the parent |
|---|---|---|
| **Find** | Daycares near home or in TX-04, each with its last state visit. No grade, no color verdict on a daycare | Finds the record for a daycare they are considering or already use |
| **Read** | Each finding: date · the state's risk level for the rule · category · fix status · a one-line plain summary · the inspector's words · a link to the official state record. A comparison with the median for the same type of daycare in the same county | Understands what happened and whether it was fixed |
| **Watch** | One tap. A push when the state posts a new finding, a permit status change, or a corrective or adverse action | Hears about new state findings without checking a website |
| **Act** | Ready-to-send requests quoting HRC §42.04271 (drop in during open hours, records and inspection reports, video only after an alleged abuse or neglect incident involving their child). Tour questions built from that daycare's own findings. Verified state report channels | Uses rights that already exist in Texas law |

## Screenshots

Every screen is the running app on real state records. Dark-mode versions are in [`docs/screenshots/dark/`](docs/screenshots/dark/).

| Find | Search | A daycare's record |
|:-:|:-:|:-:|
| <img src="docs/screenshots/01-home.jpg" width="250" alt="Home with the closest daycares"> | <img src="docs/screenshots/02-search.jpg" width="250" alt="Search by name, city, or ZIP"> | <img src="docs/screenshots/03-place-overview.jpg" width="250" alt="Place page: what the state found at the latest visit"> |
| **Past two years** | **Every finding** | **Your rights** |
| <img src="docs/screenshots/03b-place-history.jpg" width="250" alt="State visits over the past two years"> | <img src="docs/screenshots/04-findings.jpg" width="250" alt="Each finding with the inspector's words and fix status"> | <img src="docs/screenshots/05-rights.jpg" width="250" alt="Kids' Law requests ready to send"> |
| **Watch** | **Alert** | **Tour questions** |
| <img src="docs/screenshots/06-watch.jpg" width="250" alt="Turning on alerts for a daycare"> | <img src="docs/screenshots/07-alert.jpg" width="250" alt="A push alert opened: what the state posted"> | <img src="docs/screenshots/08-tour.jpg" width="250" alt="Tour questions built from this daycare's own findings"> |

A home daycare's page shows only the city and 5-digit ZIP, with no map of the house ([screenshot](docs/screenshots/09-home-daycare-privacy.jpg)).

## How it works

```mermaid
flowchart TB
  subgraph TX["data.texas.gov · Texas HHSC Child Care Regulation (SODA API)"]
    OPS["Operations · bc5r-88dy<br/>row-level daily updates"]
    ACT["Inspections · m5q4-3y3d<br/>full nightly reload"]
    VIO["Violations · tqgd-mf4x<br/>full nightly reload"]
  end
  CEN["U.S. Census Geocoder"]
  TIG["Census TIGER CD119<br/>TX-04 boundary"]
  MLY["Mapillary<br/>street photos, measured, not shown"]

  subgraph PIPE["Pipeline · Python 3.12 · daily GitHub Action"]
    P["extract → validate → stage → transform → diff →<br/>geocode → district → classify → aggregate → notify → photos → log"]
  end

  subgraph DB["Supabase · Postgres + PostGIS"]
    CORE["core.* public records"]
    APP["app.* watches, devices<br/>row-level security"]
    RPC["RPC functions<br/>the only client API"]
  end

  PUSH["Expo Push → APNs / FCM"]
  MOB["App · Expo React Native · TypeScript<br/>iPhone · Android"]

  OPS & ACT & VIO --> P
  CEN & TIG & MLY --> P
  P -- "psycopg COPY + SQL upserts" --> CORE
  P -- "new state finding × watchers" --> PUSH
  PUSH --> MOB
  MOB -- "HTTPS · anonymous sign-in" --> RPC
  RPC --> CORE
  RPC --> APP
```

| Layer | Choice | Why |
|---|---|---|
| App | Expo (React Native), TypeScript strict, Expo Router, TanStack Query, react-native-maps, expo-notifications | One codebase for iPhone and Android (Android push needs a standalone build) |
| Database | Supabase Postgres + PostGIS, row-level security, RPC functions, materialized views | The product is joins, geography (point-in-polygon, nearest daycares), and medians, all native in SQL |
| Pipeline | Python 3.12, httpx, pydantic v2, psycopg 3 (COPY), structlog | Daily full-table diffs of 200,000+ rows with a real test suite |
| Push | Expo Push API with receipts | One API for both platforms. Tokens Apple or Google reject are disabled |
| Types | `supabase gen types typescript` → `packages/db/types.ts` | The app's types come from the real schema, so they cannot drift |

### The daily pipeline

| Stage | Guarantee | Tested by |
|---|---|---|
| Validate | Unknown risk levels, bad dates, or missing fields fail the run | Contract tests on real captured records |
| Transform | Findings must join their visit at ≥ 95% or the run fails (measured: 100%) | `test_load.py` |
| Diff | Re-running a sync creates 0 new events | Idempotency test |
| Classify | Every finding gets a category from fixed rules on the state's rule number. The plain summary only shortens the inspector's words | `test_classify.py`, 100% coverage, checked against all 133,739 findings in the state file |
| Notify | One push per parent per event. A replay of a real past finding is labelled "Replay of a real state record from <date>" | `test_notify.py` round trip with receipts |
| Photos (collected, not shown) | Only Licensed Centers with an exact address match; no panoramas; camera facing the building and sideways to the road, never a dashcam view down it; taken after the permit and within 6 years | `test_photos.py` on recorded real API answers |

More in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## The data

| Dataset | ID | How the state updates it | How we sync it |
|---|---|---|---|
| Operations (daycares) | `bc5r-88dy` | Row-level, about 300 to 450 rows a day statewide | Incremental by `:updated_at`, plus a weekly full reconcile |
| Activities (visits) | `m5q4-3y3d` | Full reload nightly, about 205,000 rows | Full download, diff by `activity_id` + row hash |
| Violations (findings) | `tqgd-mf4x` | Full reload nightly, about 134,000 rows | Full download, diff by `non_compliance_id` + row hash |

**Measured Oct 24 to 25 2026:**

| Fact | Number |
|---|---|
| In-scope daycares statewide (licensed centers, licensed and registered child-care homes, listed family homes) | 14,310 |
| State visits · findings loaded | 157,358 · 118,294 |
| Daycares with a map point | 13,024 (577 from state coordinates, 12,447 from the Census Geocoder) |
| Census match quality | 10,991 exact · 1,456 non-exact (address matched with corrections) |
| Active daycares inside TX-04 by map point | at least 379 (330 exact, 28 non-exact, 21 state coordinates). 23 more fall back to county only and are never labelled TX-04 |
| TX-04 centers with a street photo that passes every rule | 14 of 209 Licensed Centers with an exact address match (6.7%). Collected, not shown in the app |
| RPC latency, p95 on the full dataset | nearest daycares 7.5 ms · search 30 ms · daycare record 1 ms |

**Inside TX-04 only** (the 379 active daycares placed in the district by map point; 13 complete weeks, Jul 20 to Oct 18 2026):

| Fact | Number |
|---|---|
| State activities at these daycares | 284 at 158 daycares, about 22 a week (238 inspections, 42 reports, 4 assessments) |
| Activities that found violations | 65. Another 23 are still marked "Pending", which fits findings being posted 1 to 3 weeks after a visit |
| Findings posted | 135: 31 under rules the state rates High risk, 55 Medium High, 47 Medium, 2 lower |
| Most common categories | Paperwork 46 · Safety hazards 34 · Health and medication 30 · Supervision 10 |
| Time between state inspections at one daycare | Median 66 days, 90th percentile 330 days (inspections since Oct 2023) |
| Daycares with at least one finding under a High-risk rule in the last 24 months | 140 of 379 |

Every field the app shows, mapped to its state column: [`docs/DATA.md`](docs/DATA.md).

## Honesty and privacy

These rules are enforced in code and tests, not just in copy review.

| Rule | Why |
|---|---|
| No scores, grades, rankings, or safe/unsafe labels. Color marks the state's risk level of one finding, never a daycare | A count of findings is not a verdict, and the state does not publish one |
| "Fixed" appears only as "Fixed during the visit" or "Fixed · state checked", never on its own. The state's `corrected_date` is shown as "Fix due <date>" | 124 findings carry a `corrected_date` in the future, so it behaves like a deadline |
| A daycare is labelled "in TX-04" only when its map point is inside the district | The state's county field can be wrong, and most of Collin and Denton counties are outside TX-04 |
| Street photos are collected and measured (14 of 209 TX-04 centers, 6.7%), but not shown | A hand check found 2 of 5 showed the right building, because a Census address point sits on the street, not the building. A wrong photo on a daycare's page would be worse than none |
| Home daycares (4,705 statewide) get no imagery, no map of the house, and no street address: city and 5-digit ZIP only | They are private residences, often listed under a person's name |
| Map links send the state's address line, not our estimated point | The geocode is an estimate |
| Kids' Law request cards are hidden for listed family homes | HRC §42.04271(a) does not cover them |
| The app never claims to alert when an investigation opens, or to be the only way to get updates | Findings appear only after state due process, and the state already offers email updates per daycare |
| No made-up data anywhere, including tests | Every fixture is a real captured record |

Parents sign in anonymously: no name, email, or phone. What is stored and what leaves the phone: [`docs/PRIVACY.md`](docs/PRIVACY.md). Every phone number, URL, and legal line traces to a verbatim quote in [`docs/OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md).

## Tests

Run on Oct 25 2026. Details: [`docs/TESTING.md`](docs/TESTING.md) · every user case, tested cold: [`docs/QA_MATRIX.md`](docs/QA_MATRIX.md).

| Suite | Result | Command |
|---|---|---|
| Database (pgTAP): schema, row-level security, every RPC, views, photos rule, search | **177 tests in 11 files, all pass** | `supabase test db` |
| Pipeline (pytest + hypothesis) | **271 tests, all pass (26 need the local database) · 92% coverage** | `cd services/pipeline && uv run pytest` |
| Pipeline static checks | ruff + `mypy --strict` clean | `uv run ruff check . && uv run mypy --strict src` |
| App unit (Jest) | **37 tests, all pass** | `cd apps/mobile && npx jest` |
| App end-to-end (Maestro) | 11 flows, including find-to-alert and the largest text size | `maestro test apps/mobile/e2e/journey-find-watch.yaml` |
| App static checks | `tsc --noEmit`, ESLint | `npm run typecheck --prefix apps/mobile` |

GitHub Actions runs the pipeline checks on every push and the daily sync at 10:15 UTC, about an hour after the state's nightly reload.

## Getting started

Requirements: Node 20+, Python 3.12 with [uv](https://docs.astral.sh/uv/), the Supabase CLI, and Docker.

```bash
# 1. Database: Postgres + PostGIS with every migration applied
supabase start
supabase test db

# 2. Data: load the real state records. About 4 to 5 minutes the first time: it downloads
#    about 205,000 visits and 134,000 findings and geocodes about 13,700 addresses with the
#    Census batch geocoder (cached after that)
cd services/pipeline
uv sync
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres uv run python -m pipeline backfill

# Optional: the pipeline tests (26 use the database; one more reads the full findings file)
curl -o .cache/tqgd-mf4x.csv "https://data.texas.gov/resource/tqgd-mf4x.csv?\$limit=200000"
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres uv run pytest -q
cd ../..

# 3. App
npm install
echo "EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321" >  apps/mobile/.env.local
echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from: supabase status>" >> apps/mobile/.env.local
cd apps/mobile && npx expo start
```

A fresh clone run this way on Oct 25 2026 loaded the same numbers as this README: 14,310 daycares, 379 inside TX-04 by map point, and pipeline tests at 270 passed, 1 skipped, 0 failed. The skipped one reads the full findings file from the optional download.

On a real phone, use the computer's LAN address in `EXPO_PUBLIC_SUPABASE_URL` instead of `127.0.0.1`.

| Pipeline command | What it does |
|---|---|
| `python -m pipeline sync` | The daily run: extract, validate, load, diff, classify, alert |
| `python -m pipeline backfill` | Load full history without sending alerts |
| `python -m pipeline sync --replay-latest <operation_id>` | Re-send the findings from the newest visit at a daycare as one push, labelled as a replay (add `--dry-run` to preview) |
| `python -m pipeline photos` | Collect and measure street photos for TX-04 centers; not shown in the app (needs `MAPILLARY_TOKEN`) |
| `python -m pipeline report` · `receipts` | Recent runs · push delivery receipts |

## Project structure

```text
daycare-watch/
├── apps/mobile/                 # The parent app: Expo, iOS + Android
│   ├── src/app/                 #   screens (Expo Router): tabs, daycare/[id], alert, onboarding, search
│   ├── src/components/ui/       #   design system components
│   ├── src/lib/                 #   API client, rights text, tour questions, storage
│   └── e2e/                     #   Maestro flows
├── services/pipeline/           # Daily data pipeline (Python 3.12)
│   ├── src/pipeline/            #   soda · models · load · geocode · classify · notify · photos · runner
│   ├── tests/                   #   pytest + hypothesis
│   └── fixtures/                #   real captured state records and API answers
├── supabase/
│   ├── migrations/              # schema, row-level security, RPC functions, views
│   └── tests/                   # pgTAP
├── packages/db/                 # TypeScript types generated from the schema
├── docs/                        # architecture, data dictionary, privacy, testing, sources
└── .github/workflows/           # pipeline CI and the daily sync
```

## Roadmap

| Next | Why |
|---|---|
| Android push from a standalone build | Expo Go on Android cannot receive remote pushes |
| Street photos that show the right building | Collected for 14 of 209 TX-04 centers but not shown: a Census address point sits on the street, not the building. Needs a rooftop or parcel point first |
| Spanish | So a parent who reads Spanish first gets the same plain-English summaries and rights, in Spanish |
| Any Texas district, not only TX-04 | The pipeline already loads the whole state; only the district boundary is TX-04 |
| Federal rights, if a federal law passes | Add its rights next to the Texas ones |

## Known limits

- Findings appear only after the daycare has had due process. Alerts can arrive days to weeks after a visit.
- 1,286 in-scope daycares have no map point (no state coordinates and no Census match). They stay findable by search.
- Census matches place an address along its street range, not on the rooftop.

## Docs

| Doc | What |
|---|---|
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, pipeline stages, tables |
| [`DATA.md`](docs/DATA.md) | Every field shown in the app and its state source |
| [`PRIVACY.md`](docs/PRIVACY.md) | What is stored, what leaves the phone, and the rules that protect people in the records |
| [`TESTING.md`](docs/TESTING.md) | Every suite, with the counts from the last run |
| [`QA_MATRIX.md`](docs/QA_MATRIX.md) | Every user case, tested cold, with evidence |
| [`OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md) | Every legal claim, phone number, and URL, with a verbatim source quote |

## License

[MIT](LICENSE). State records are public data published by the Texas Health and Human Services Commission.
