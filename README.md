<div align="center">

# Daycare Watch

**For Texas parents: see what state inspectors found at a daycare, in plain English, and get an alert when the state posts something new.**

### [Try it: daycare-watch.vercel.app](https://daycare-watch.vercel.app)
No sign-in. Real Texas state records. Works on any phone or computer.

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

## Try it in 30 seconds

1. Open **[daycare-watch.vercel.app](https://daycare-watch.vercel.app)** on any phone or computer.
2. Search a name, city, or ZIP in TX-04, for example `Montessori`, `Rockwall`, or `75034`.
3. Open a daycare: its latest state visit in plain English, each finding with the inspector's own words, and a link to the official state record.
4. On that daycare's page, tap **Your rights**: the three Kids' Law requests (your child's records, a drop-in visit, incident video), written and ready to send.

## Contents

- [Why](#why) · [How a parent uses it](#how-a-parent-uses-it) · [Screenshots](#screenshots)
- [How it works](#how-it-works) · [The data](#the-data) · [Figures](#figures) · [Honesty and privacy](#honesty-and-privacy)
- [Try it](#try-it-in-30-seconds) · [Tests](#tests) · [Getting started](#getting-started) · [Project structure](#project-structure) · [Roadmap](#roadmap) · [Methods and limitations](#methods-and-limitations) · [Research and references](#research-and-references) · [Docs](#docs) · [Built with](#built-with)

## Why

- **The gap:** Texas posts every inspection report online [[19]](docs/RESEARCH.md#references), but only on a search site, one daycare at a time, and only after due process [[17]](docs/RESEARCH.md#references).
- **What it does:** reads the state's open data every day and shows each finding in plain English: when, how serious the state rates the rule, and whether the state has checked the fix. A push arrives when the state posts something new at a daycare a parent watches.
- **What a parent can do next:** ready-to-send requests under the **Kairo and the Kids' Law** (88(R) SB 1098, 2023), which overlap with Rep. Pat Fallon's proposed federal Kairo Act (H.R. 2425, introduced Mar 27 2025, not law; it adds a 2-business-day video deadline but no drop-in right) [[1, 3, 29]](docs/RESEARCH.md#references).

> The app never calls a daycare safe or unsafe, and never scores, grades, or ranks one. It shows what the state found, when, and whether the state has checked the fix.

| | |
|---|---|
| **Daycares in TX-04** | **At least 379** active daycares inside the district by map point (PostGIS point-in-polygon against the Census TIGERweb CD119 boundary) |
| **State records loaded** | 14,310 daycares · 157,358 state visits · 118,294 findings, about 5 years of history |
| **Freshness** | Synced daily from data.texas.gov. Every data screen shows "Last checked with the state" |
| **Proven end to end** | A real past state finding, replayed as a labelled alert, reached a real iPhone as a push (Expo receipt `delivered_to_provider`) and opened that daycare's record ([QA matrix B6](docs/QA_MATRIX.md)) |
| **Platforms** | Web at [daycare-watch.vercel.app](https://daycare-watch.vercel.app) (no sign-in; alerts need the phone app). iPhone, tested on device. Android runs from the same code; Android push needs a development or standalone build, not Expo Go |

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
    OPS["Operations · bc5r-88dy<br/>row-level updates"]
    ACT["Inspections · m5q4-3y3d<br/>full reload, usually overnight"]
    VIO["Violations · tqgd-mf4x<br/>full reload, usually overnight"]
  end
  CEN["U.S. Census Geocoder"]
  TIG["Census TIGERweb CD119<br/>TX-04 boundary"]
  MLY["Mapillary<br/>street photos, hand-checked"]

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
| App | Expo (React Native), TypeScript strict, Expo Router, TanStack Query, react-native-maps, expo-notifications | One codebase for iPhone and Android (Android push needs a development or standalone build, not Expo Go) |
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
| Photos (hand-checked) | Only Licensed Centers with an exact address match. A photo ships only after a person looked at it and saw that daycare (its name on the building); at most 2 per center, from different drives, within 6 years | `test_photos.py` on recorded real API answers and the reviewed list `data/verified_photos.csv` |

### When the state posts something new

```mermaid
sequenceDiagram
  autonumber
  participant S as data.texas.gov
  participant G as GitHub Action (daily)
  participant P as Pipeline
  participant D as Postgres (core.*, app.*)
  participant E as Expo Push
  participant A as Parent's phone
  S->>S: Reloads visits and findings (usually overnight)
  G->>P: python -m pipeline sync
  P->>S: Download 3 datasets (SODA, paged)
  P->>P: Validate every row against the data contract
  P->>D: COPY to staging, upsert core.*, join each finding to its visit
  P->>D: Diff by ID + row hash → core.change_events
  P->>D: Watches × new events, minus (user, event) already sent
  P->>E: One push per parent per visit, batches of ≤ 100
  E->>A: "The state posted 2 new findings from a visit on …"
  P->>E: Check receipts, disable tokens Apple or Google reject
  A->>D: Tap → daycare_record() → the visit's findings
```

### From the state's columns to the screen

```mermaid
flowchart LR
  subgraph SRC["State columns"]
    s1["operation_name · address · type · status"]
    s2["activity_id · activity_date · activity_type · self_report"]
    s3["non_compliance_id · standard_number_description<br/>standard_risk_level · narrative<br/>corrected_date · date_correction_verified"]
  end
  subgraph CORE["Our tables"]
    c1["core.daycares<br/>+ geocode point · in_district"]
    c2["core.inspections"]
    c3["core.violations<br/>+ category · plain summary"]
  end
  subgraph UI["What a parent reads"]
    u1["Name, type, city · 'in TX‑04' only by map point"]
    u2["'Visit' only for an inspection;<br/>'the daycare's own report' for a self-report"]
    u3["Plain summary + the inspector's own words<br/>'Fix due …' · 'Fixed · state checked'"]
  end
  s1 --> c1 --> u1
  s2 --> c2 --> u2
  s3 --> c3 --> u3
  c2 -.->|"joined on activity_id, 100% measured"| c3
```

More in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## The data

| Dataset | ID | What we observed (Oct 2026) | How we sync it |
|---|---|---|---|
| Operations (daycares) | `bc5r-88dy` | Row-level, about 300 to 450 rows a day statewide | Incremental by `:updated_at`, plus a weekly full reconcile |
| Activities (visits) | `m5q4-3y3d` | Full reload, usually overnight; about 205,000 rows | Full download, diff by `activity_id` + row hash |
| Violations (findings) | `tqgd-mf4x` | Full reload, usually overnight; about 134,000 rows | Full download, diff by `non_compliance_id` + row hash |

**Measured Oct 24 to 25 2026:**

| Fact | Number |
|---|---|
| In-scope daycares statewide (licensed centers, licensed and registered child-care homes, listed family homes) | 14,310 |
| State visits · findings loaded | 157,358 · 118,294 |
| Daycares with a map point | 13,024 (577 from state coordinates, 12,447 from the Census Geocoder) |
| Census match quality | 10,991 exact · 1,456 non-exact (the Census Geocoder's "Non_Exact" match type) |
| Active daycares inside TX-04 by map point | at least 379 (330 exact, 28 non-exact, 21 state coordinates). 23 more fall back to county only and are never labelled TX-04 |
| TX-04 centers with a street-level picture | Apple Look Around (iPhone app) gives a street-level picture for 6 of 20 TX-04 centers sampled, each checked by eye: 3 where Apple's place has the daycare's name within 60 m of the state's address, and 3 where a person checked that the street view at the address shows the building (`services/pipeline/data/street_view_checks.csv`). The other 14 show the view from above. Mapillary: a hand-checked photo for 1 of 209 Licensed Centers with an exact address match. 80 had any Mapillary image within 60 m of the building; all 107 images facing a building were checked by eye, and 2 (one center) showed the daycare |
| RPC latency, p95 on the full dataset | nearest daycares 7.5 ms · search 30 ms · daycare record 1 ms |

**Inside TX-04 only** (the 379 active daycares placed in the district by map point; 13 complete weeks, Jul 20 to Oct 18 2026):

| Fact | Number |
|---|---|
| State activities at these daycares | 284 at 158 daycares, about 22 a week (238 inspections, 42 reports, 4 assessments) |
| Activities that found violations | 65. Another 23 are still marked "Pending" (findings not posted yet) |
| Findings posted | 135: 31 under rules the state rates High risk, 55 Medium High, 47 Medium, 2 lower |
| Most common categories | Paperwork 46 · Safety hazards 34 · Health and medication 30 · Supervision 10 |
| Time between state inspections at one daycare | Median 66 days, 90th percentile 330 days (inspections since Oct 2023) |
| Daycares with at least one finding under a High-risk rule in the last 24 months | 140 of 379 |

Every field the app shows, mapped to its state column: [`docs/DATA.md`](docs/DATA.md).

## Figures

Drawn by [`scripts/figures.py`](scripts/figures.py) straight from the loaded state files (pulled Oct 25 2026). Each figure's n, source, plotted numbers (CSV), and exact SQL are in [`docs/figures/README.md`](docs/figures/README.md). A count of findings is not a verdict on a daycare, and no figure names or rates one.

**From the state's files to the app.** 14,977 operations rows → 14,310 daycares in scope → 379 active inside TX-04 by map point; 133,739 finding rows → 118,294 at in-scope daycares, all 118,294 joined to their visit.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/data-funnel-dark.svg">
  <img src="docs/figures/data-funnel-light.svg" alt="Bars from the state's raw row counts to in-scope daycares, visits and findings, findings joined to their visit, and daycares inside TX-04" width="100%">
</picture>

**Where the 379 are.** 234 licensed centers drawn as dots; 145 home daycares shown only as counts per 5 km hexagon, never as points.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/tx04-map-dark.svg">
  <img src="docs/figures/tx04-map-light.svg" alt="Map of TX-04 with one dot per active licensed center and home daycares shown only as counts per hexagon" width="100%">
</picture>

**Findings per month, statewide, by the state's risk level for the rule.** Nov 2021 to Sep 2026: 1,364 to 2,523 a month (median 1,955).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/findings-by-month-dark.svg">
  <img src="docs/figures/findings-by-month-light.svg" alt="Stacked monthly columns of state findings at Texas daycares, split by the state's risk level for the rule" width="100%">
</picture>

**What the rules were about.** Paperwork is the largest category statewide (31.1%) and in TX-04 (36.3%); Safety hazards are 28.1% statewide and 22.5% in TX-04 (n = 118,294 and 3,016).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/categories-dark.svg">
  <img src="docs/figures/categories-light.svg" alt="Dot plot of the share of findings in each rule category, statewide and in TX-04" width="100%">
</picture>

**Did the state check the fix?** Of 49,768 findings in the last 24 months, the state recorded checking the fix on 89.1%, 10.0% were fixed during the visit, and 0.8% have neither on record yet. This is why the app says "Fixed" only with one of those two.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/fix-follow-through-dark.svg">
  <img src="docs/figures/fix-follow-through-light.svg" alt="Share of findings where the state recorded checking the fix, fixed during the visit, or neither yet, by risk level" width="100%">
</picture>

**One rule, followed over time.** 26 TAC §746.2905(1), a center must not force a child to sleep [[10]](docs/RESEARCH.md#references): cited 123 times statewide from Q1 2022 to Q3 2026, 8 of them inside TX-04.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/nap-rule-dark.svg">
  <img src="docs/figures/nap-rule-light.svg" alt="Quarterly citations of rule 746.2905(1), TX-04 and the rest of Texas" width="100%">
</picture>

**Not charted:** days from inspection to posting. It is not measured yet, so there is no figure and no estimate ([why](docs/figures/README.md#not-charted-days-from-inspection-to-posting)).

## Honesty and privacy

These rules are enforced in code and tests, not just in copy review.

| Rule | Why |
|---|---|
| No scores, grades, rankings, or safe/unsafe labels. Color marks the state's risk level of one finding, never a daycare | A count of findings is not a verdict, and the state does not publish one |
| "Fixed" appears only as "Fixed during the visit" or "Fixed · state checked", never on its own. The state's `corrected_date` is shown as "Fix due <date>" | 124 findings carry a `corrected_date` in the future, so it behaves like a deadline |
| A daycare is labelled "in TX-04" only when its map point is inside the district | The state's county field can be wrong, and most of Collin and Denton counties are outside TX-04 |
| A street-level picture is shown only where a person checked it shows that daycare: Apple Look Around for 6 of 20 TX-04 centers sampled, Mapillary for 1 of 209 | Rules alone picked the wrong building 3 times in 5, because a Census address point sits on the street, not the building. Most street imagery here is dashcam footage of the road. A wrong photo on a daycare's page would be worse than none |
| Home daycares (4,705 statewide) get no imagery, no map of the house, and no street address: city and 5-digit ZIP only | They are the caregiver's own home |
| Map links send the state's address line, not our estimated point | The geocode is an estimate |
| Kids' Law request cards are hidden for listed family homes | HRC §42.04271(a) does not cover them |
| The app never claims to alert when an investigation opens, or to be the only way to get updates | Findings appear only after state due process, and the state already offers email updates per daycare |
| No made-up data anywhere, including tests | Every fixture is a real captured record |

Parents sign in anonymously: no name, email, or phone. What is stored and what leaves the phone: [`docs/PRIVACY.md`](docs/PRIVACY.md). Every phone number, URL, and legal line traces to a verbatim quote in [`docs/OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md).

## Tests

Run on Oct 25 2026. Details: [`docs/TESTING.md`](docs/TESTING.md) · every user case, tested cold: [`docs/QA_MATRIX.md`](docs/QA_MATRIX.md).

| Suite | Result | Command |
|---|---|---|
| Database (pgTAP): schema, row-level security, every RPC, views, photos rule, search, home privacy | **185 tests in 11 files, all pass** | `supabase test db` |
| Pipeline (pytest + hypothesis) | **283 tests, all pass (29 need the local database) · 93% coverage** | `cd services/pipeline && uv run pytest` |
| Pipeline static checks | ruff + `mypy --strict` clean | `uv run ruff check . && uv run mypy --strict src` |
| App unit (Jest) | **37 tests, all pass** | `cd apps/mobile && npx jest` |
| App end-to-end (Maestro) | 11 flows, including find-to-alert and the largest text size | `maestro test apps/mobile/e2e/journey-find-watch.yaml` |
| App static checks | `tsc --noEmit`, ESLint | `npm run typecheck --prefix apps/mobile` |

GitHub Actions runs the pipeline checks on every push and the daily sync at 10:15 UTC, about an hour after the state usually reloads its files, with a second run at 11:47 UTC in case GitHub starts the first one late or skips it (a re-run creates no new events). GitHub does start scheduled runs late: on Oct 25 2026 the two runs began at 14:23 and 15:02 UTC, 3 to 4 hours after their set times.

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

# Optional: the pipeline tests (29 use the database; one more reads the full findings file)
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
| `python -m pipeline photos` | Find street-photo candidates for TX-04 centers to review by eye (needs `MAPILLARY_TOKEN`); `--load-verified` loads the reviewed list, which the daily sync also does |
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
| More street photos of the right building | Mapillary has a checked photo for 1 of 209 TX-04 centers. More need new street imagery or a rooftop point per daycare, and every photo still gets checked by eye |
| Spanish | So a parent who reads Spanish first gets the same plain-English summaries and rights, in Spanish |
| Any Texas district, not only TX-04 | The pipeline already loads the whole state; only the district boundary is TX-04 |
| Federal rights, if a federal law passes | Add its rights next to the Texas ones |

## Methods and limitations

How each number on this page is made, and where it can be wrong.

| Topic | Method | Limitation |
|---|---|---|
| **Scope** | Four operation types the state licenses or lists: licensed centers, licensed child-care homes, registered child-care homes, listed family homes (14,310 of 14,977 rows in the operations file). Findings and visits are kept when they belong to one of these | Other operation types (for example residential care) are out of scope |
| **Joining findings to visits** | Each finding joins its visit on `activity_id`. A run fails below 95% | Measured 100% on every run so far |
| **Validation** | Every row passes a typed data contract (pydantic). An unknown risk level, a bad date, or a missing field fails the whole run instead of loading a guess | A new value the state introduces stops the sync until the contract is updated |
| **State text** | Shown as the state wrote it, with two repairs: a `?` the state's file put where a character was lost is restored in 69 of 70 daycare names, and lost apostrophes ("child?s") in findings | The plain summary shortens and de-jargons; a property test checks it never adds a number |
| **Placing daycares** | State coordinates when present (577), else the U.S. Census batch geocoder (12,447: 10,991 exact, 1,456 non-exact). "In TX-04" means the point is inside the Census TIGERweb CD119 boundary, Jan 1 2026 vintage (PostGIS `ST_Covers`) | A Census point sits along the street's address range, not on the roof. 1,286 daycares have no point; 23 near TX-04 fall back to county only and are never labelled TX-04 |
| **Freshness** | The pipeline runs daily from GitHub Actions at 10:15 and 11:47 UTC; every data screen shows "Last checked with the state" | The state reloads usually overnight, not every night (no reload seen Sat night, Oct 24 to 25). GitHub started the Oct 25 runs 3 to 4 hours late |
| **Time from visit to posting** | Measured per run: days from `activity_date` to the night a finding first appears (median and 90th percentile in `ops.sync_runs`) | **Not yet measured.** The history was loaded in one backfill, and the state has posted nothing new since. The state posts violations only after the daycare has had due process or waived it [[17]](docs/RESEARCH.md#references); the state gives no time frame, and we have not measured one yet |
| **Alerts** | One push per parent per visit with new findings, deduplicated on (parent, event); permit status, capacity, and enforcement flags too | Never on an investigation opening: the state publishes findings only after due process |
| **Pictures** | Shown only after a person checked they show that daycare (Apple Look Around 6 of 20 sampled; Mapillary 1 of 209) | Most daycares show only the view from above |
| **Homes** | City and 5-digit ZIP only: no street, no map of the house, no imagery | |

**What the app never claims:** that a daycare is safe or unsafe; any score, grade, or rank; that a fix happened unless the state recorded checking it; that an alert arrives when an investigation opens; that it is the only way to follow a daycare (the state offers email updates).

## Research and references

Every legal, dataset, district, and contest claim in this README was checked against a primary or official source on Oct 25 2026. [`docs/RESEARCH.md`](docs/RESEARCH.md) lists 56 sources with the exact URL opened and maps each claim to them; [`docs/OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md) holds the verbatim quotes behind every phone number and legal line in the app. The ones this page leans on:

| # | Source | Used for |
|---|---|---|
| 1 | Texas Human Resources Code ch. 42, §42.04271 | The parent rights in the Kids' Law requests, and which daycare types they cover |
| 3 | 88(R) SB 1098, enrolled ("Kairo and the Kids' Law"), effective Sep 1 2023 | The law's name and date |
| 10, 13 | 26 TAC §746.2905; HHSC *Minimum Standards for Child-Care Centers* | The nap rule; the state's five risk weights rate the rule, not the daycare |
| 17 | HHSC *Search Texas Child Care*, operation details | Findings are posted only after due process; the state's own email updates |
| 24-26 | data.texas.gov `bc5r-88dy`, `m5q4-3y3d`, `tqgd-mf4x` (CC0 1.0) | Every daycare, visit, and finding |
| 29, 30 | H.R. 2425, Kairo Act of 2025 (introduced, not law) | What the federal bill would add, and what it leaves out |
| 38, 40 | Census Geocoder user guide; TIGERweb 119th Congressional Districts | How map points are made; the TX-04 boundary |
| 44, 45 | Expo Push Service; Expo Notifications | Batches of 100, receipts, and why Android push needs a development or standalone build |
| 55 | GitHub Actions `schedule` event | Why the daily sync runs twice |

## Docs

| Doc | What |
|---|---|
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, pipeline stages, tables |
| [`DATA.md`](docs/DATA.md) | Every field shown in the app and its state source |
| [`PRIVACY.md`](docs/PRIVACY.md) | What is stored, what leaves the phone, and the rules that protect people in the records |
| [`TESTING.md`](docs/TESTING.md) | Every suite, with the counts from the last run |
| [`QA_MATRIX.md`](docs/QA_MATRIX.md) | Every user case, tested cold, with evidence |
| [`OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md) | Every legal claim, phone number, and URL, with a verbatim source quote |
| [`RESEARCH.md`](docs/RESEARCH.md) | 56 sources with URLs, and every README claim mapped to them |
| [`figures/`](docs/figures/README.md) | The data figures, with n, source, CSV, and SQL for each |

## Built with

Every outside library, data source, and service the project uses, as the contest rules ask.

| Part | Open-source libraries (license) |
|---|---|
| App | Expo SDK and Expo Router (MIT) · React Native and React Native Web (MIT) · TypeScript (Apache-2.0) · @supabase/supabase-js (MIT) · TanStack Query (MIT) · react-native-maps (MIT) · @gorhom/bottom-sheet (MIT) · Reanimated and Gesture Handler (MIT) · react-native-mmkv (MIT) · react-native-svg (MIT) · qrcode-generator (MIT, the QR beside the web iPhone frame) · Newsreader and Public Sans fonts (SIL OFL 1.1) |
| Database | PostgreSQL (PostgreSQL License) · PostGIS (GPL-2.0) · pgTAP for tests (PostgreSQL License) |
| Pipeline | Python 3.12 · httpx (BSD-3) · pydantic (MIT) · psycopg 3 (LGPL-3.0) · structlog (MIT / Apache-2.0) · pytest, ruff, mypy for checks |
| App tests | Jest and jest-expo (MIT) · React Native Testing Library (MIT) · Maestro flows for the simulator |

| Data or service | Used for |
|---|---|
| [data.texas.gov](https://data.texas.gov), Texas HHSC Child Care Regulation | Every daycare, visit, and finding (public open data) |
| U.S. Census Geocoder and TIGERweb CD119 | Map points for addresses, and the TX-04 boundary (U.S. Government works, not subject to copyright, 17 U.S.C. §105) |
| Esri World Imagery | Aerial view on the place page, credited on screen |
| Apple Maps (MapKit) | Map, 3D view, and directions on iPhone |
| Mapillary (CC BY-SA 4.0) | Street photos, shown only after a person checks the photo shows that daycare, with the photographer credited |
| OpenStreetMap (ODbL), © OpenStreetMap contributors | Building outlines used once, during the hand review, to find street photos that face a daycare's building. Not shipped in the app |
| Supabase · GitHub Actions · Expo Push · Vercel | Database hosting · the daily sync · push alerts · the web link |

## License

[MIT](LICENSE). State records are public data published by the Texas Health and Human Services Commission.
