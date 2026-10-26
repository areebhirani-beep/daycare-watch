<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/banner-dark.png">
  <img src="docs/readme/banner-light.png" alt="Daycare Watch. Find the right daycare for your family. See what Texas inspectors found at any daycare, and get a heads-up when they post something new. 2026 Congressional App Challenge, Texas's 4th District." width="100%">
</picture>

<div align="center">

### [Try it: daycare-watch.vercel.app](https://daycare-watch.vercel.app) &nbsp;·&nbsp; [Watch the 3-minute demo](https://youtu.be/UcrsTslTqGI)

No sign-in. Real Texas state records. The website is a preview of the app; the full app, with alerts, runs on iPhone and Android.

[![App CI](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/app-ci.yml/badge.svg)](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/app-ci.yml)
[![Pipeline CI](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/pipeline-ci.yml/badge.svg)](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/pipeline-ci.yml)
[![Daily sync](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/daily-sync.yml/badge.svg)](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/daily-sync.yml)

![Expo SDK 58](https://img.shields.io/badge/Expo_SDK-58-1C1C1E?style=flat-square&logo=expo&logoColor=white)
![React Native 0.88](https://img.shields.io/badge/React_Native-0.88-1C1C1E?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript 6](https://img.shields.io/badge/TypeScript-6-1C1C1E?style=flat-square&logo=typescript&logoColor=3178C6)
![Python 3.12](https://img.shields.io/badge/Python-3.12-1C1C1E?style=flat-square&logo=python&logoColor=FFD43B)
![PostgreSQL + PostGIS](https://img.shields.io/badge/Postgres-PostGIS-1C1C1E?style=flat-square&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-database-1C1C1E?style=flat-square&logo=supabase&logoColor=3FCF8E)
[![MIT license](https://img.shields.io/badge/license-MIT-1C1C1E?style=flat-square)](LICENSE)

</div>

<table>
<tr>
<td align="center" width="20%"><h2>14,310</h2>Texas daycares in the state's files, centers and home daycares</td>
<td align="center" width="20%"><h2>118,294</h2>state findings, each joined to the visit it came from</td>
<td align="center" width="20%"><h2>1,347</h2>findings at daycares in TX-04 in the last two years, at least</td>
<td align="center" width="20%"><h2>545</h2>automated tests across the pipeline, the database, and the app</td>
<td align="center" width="20%"><h2>5:15 am</h2>Central, every morning: the state's newest files, checked and loaded</td>
</tr>
</table>

## Contents

[Why we built this](#why-we-built-this) · [Why TX-04](#why-texass-4th-district) · [Try it](#try-it-in-30-seconds) · [What a parent does](#what-a-parent-does) · [How it works](#how-it-works) · [What the data shows](#what-the-data-shows) · [Privacy](#privacy-by-design) · [Tests](#tests) · [Built with](#built-with) · [Run it yourself](#run-it-yourself) · [Roadmap](#roadmap) · [Sources](#sources-and-docs)

## Why we built this

This app is personal to us. Areeb's cousin came home from her daycare crying every single day, and his uncle had no idea where to look. Texas already sends inspectors into every licensed daycare and publishes what they find, but it sits in an open dataset of more than a hundred thousand rows of rule numbers and legal language. In Texas's 4th District alone, inspectors wrote down at least 1,347 findings in the two years to Oct 25 2026. Daycare Watch puts those reports in front of parents in words they can follow, and tells them when something new is posted. The app cannot detect or prevent anything that happens at a daycare; it makes what the state already knows easy to find.

The app never calls a daycare safe or unsafe, and never scores, grades, or ranks one. It shows what the state found, when, and whether the state has checked the fix.

## Why Texas's 4th District

In 2018, a two-month-old baby named Kairo was badly hurt at his daycare in McKinney. Congressman Pat Fallon (TX-04) introduced the [Kairo Act (H.R. 2425)](https://www.congress.gov/bill/119th-congress/house-bill/2425) in March 2025. It would require child care providers that receive federal funds to give parents a written bill of rights, including access to their child's records, inspection reports, and video of an alleged incident. The bill has been introduced and referred to committee; it is not law. Texas already gives parents most of these rights in Kairo and the Kids' Law (SB 1098, [Human Resources Code §42.04271](https://statutes.capitol.texas.gov/Docs/HR/htm/HR.42.htm)), and the app's **Your rights** tab turns them into requests a parent can send.

```mermaid
flowchart LR
  A["Dec 2018<br/>Kairo, two months old,<br/>is badly hurt at a<br/>McKinney daycare"] --> B["Jun 18 2023<br/>Texas signs SB 1098,<br/>Kairo and the Kids' Law<br/>(in effect Sep 1 2023)"]
  B --> C["Mar 27 2025<br/>Rep. Fallon introduces<br/>the federal Kairo Act,<br/>H.R. 2425"]
  C --> D["Today<br/>H.R. 2425 is in committee,<br/>not law"]
  B --> E["Daycare Watch<br/>Your rights tab: the Texas<br/>rights as ready-to-send letters"]
  classDef app fill:#FFC800,stroke:#111,color:#111
  class E app
```

Sources for every date and legal line, with verbatim quotes: [`docs/OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md) and [`docs/SOURCES.md`](docs/SOURCES.md).

## Try it in 30 seconds

1. Open **[daycare-watch.vercel.app](https://daycare-watch.vercel.app)** on any phone or computer.
2. Search a name, city, or ZIP in TX-04, for example `Montessori`, `Rockwall`, or `75034`. Misspellings work too.
3. Open a daycare: what the state found at its latest visit, each finding with the inspector's own words, and a link to the official state record.
4. Tap **Your rights** under the daycare's name: the requests Texas law already gives parents (your child's records, a drop-in visit, incident video). Tap one to see the letter, filled in and ready to copy or email.
5. See what a parent's alert looks like: **[daycare-watch.vercel.app/alert/example](https://daycare-watch.vercel.app/alert/example)**, a real Oct 5 2026 inspection replayed and labelled as an example.

In the phone app, **Watch this daycare** turns on a push alert for the next time the state posts something about it.

| Find | A daycare's record | Every finding |
|:-:|:-:|:-:|
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/02-search.png"><img src="docs/screenshots/framed/light/02-search.png" width="240" alt="Search by name, city, or ZIP"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/03b-place-history.png"><img src="docs/screenshots/framed/light/03b-place-history.png" width="240" alt="State visits over the past two years"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/04-findings.png"><img src="docs/screenshots/framed/light/04-findings.png" width="240" alt="Each finding with the inspector's words and fix status"></picture> |
| **Your rights** | **Watch** | **Tour questions** |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/05-rights.png"><img src="docs/screenshots/framed/light/05-rights.png" width="240" alt="Ready-to-send requests under Texas law"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/06-watch.png"><img src="docs/screenshots/framed/light/06-watch.png" width="240" alt="Turning on alerts for a daycare"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/08-tour.png"><img src="docs/screenshots/framed/light/08-tour.png" width="240" alt="Tour questions built from this daycare's own findings"></picture> |

## What a parent does

Two kinds of parents use it: one choosing a daycare, and one whose child already goes to one.

```mermaid
flowchart LR
  F["Find<br/>name, city, ZIP,<br/>or nearest first"] --> R["Read<br/>the latest visit, each finding<br/>in the inspector's words,<br/>fixed or not"]
  R --> Q["Ask<br/>tour questions built from<br/>this daycare's own findings"]
  R --> AR["Act<br/>a records or drop-in request<br/>under Texas law, filled in"]
  R --> W["Watch<br/>one tap, no account"]
  W -. "the state posts<br/>something new" .-> P["Alert<br/>a push on the phone,<br/>opens that visit"]
  P --> R
  classDef app fill:#FFC800,stroke:#111,color:#111
  class P app
```

<details>
<summary><b>Every screen in the app</b></summary>

```mermaid
flowchart TB
  subgraph ON["First open"]
    o1["Welcome"] --> o2["How it works<br/>(3 pages)"] --> o3["Find your daycare"] --> o4["Watching"]
  end
  subgraph TABS["Tabs"]
    t1["Find<br/>nearest first · TX-04 filter"]
    t2["Watching<br/>your daycares"]
    t3["Your rights<br/>SB 1098, as a request letter"]
  end
  o3 -- "I'm just looking" --> t1
  o4 --> t2
  t1 --> s["Search"] --> d
  t1 --> wk["TX-04 last week<br/>every state visit"] --> d
  t1 --> d["Daycare record<br/>Overview · Problems · Your rights"]
  t2 --> d
  t2 --> ex["Example alert"]
  d --> cat["What the categories mean"]
  d --> tour["Tour questions"]
  d --> wt["Watch this daycare"]
  d --> let["Request letter<br/>copy or email"]
  t3 --> let
  t3 --> rep["Report a concern<br/>911 · state hotline · HHSC form"]
  push(["Push alert"]) --> al["Alert<br/>what changed since the last visit"] --> d
```

</details>

## How it works

The state publishes three open datasets on data.texas.gov: daycares, visits, and findings. Each morning a GitHub Action downloads all three, checks every row against a typed data contract, joins each finding to the visit it came from, and compares them with the day before. Anything new at a daycare a parent watches becomes one push alert per visit. The app reads the database only through a small set of SQL functions.

```mermaid
flowchart LR
  TX["data.texas.gov<br/>daycares · visits · findings"] --> P["Pipeline (Python, every morning)<br/>validate → join → diff → plain summary"]
  CEN["Census geocoder<br/>and the TX-04 boundary"] --> P
  P --> DB[("Postgres + PostGIS<br/>Supabase")]
  P -- "new finding × watchers" --> PUSH["Expo Push"] --> APP["Phone app<br/>iPhone · Android"]
  APP -- "SQL functions only" --> DB
  WEB["Website<br/>daycare-watch.vercel.app"] -- "the same SQL functions" --> DB
  classDef app fill:#FFC800,stroke:#111,color:#111
  class APP app
```

### When the state posts something new

```mermaid
sequenceDiagram
  autonumber
  participant S as data.texas.gov
  participant G as GitHub Action
  participant P as Pipeline
  participant D as Postgres
  participant E as Expo Push
  participant A as Parent's phone
  G->>P: 5:15 am Central (a second run at 6:47 in case GitHub skips one)
  P->>S: Download the 3 datasets, paged
  P->>P: Validate every row against the data contract
  P->>D: Stage, then upsert, joining each finding to its visit
  P->>D: Diff by state ID and row hash → change events
  P->>D: Watches × new events, minus anything already sent
  P->>E: One push per parent per visit, batches of up to 100
  E->>A: "The state posted 2 new findings from a visit on …"
  P->>E: Check receipts, turn off tokens Apple or Google reject
  A->>D: Tap → daycare_record() → that visit's findings
```

### The run stops instead of guessing

A parent seeing correct information from yesterday is better than seeing something that might be wrong, so every gate below fails the whole run and loads nothing new.

```mermaid
flowchart LR
  v{"Every row matches<br/>the data contract?"} -- yes --> j{"Findings joined to<br/>their visit ≥ 95%?<br/>(measured: 100%)"}
  j -- yes --> df{"Re-running creates<br/>0 new events?"}
  df -- yes --> n["Notify<br/>one push per parent<br/>per event, never twice"]
  v -- "unknown risk level,<br/>bad date, missing field" --> x["Stop.<br/>Load nothing.<br/>Yesterday's data stays."]
  j -- no --> x
  df -- no --> x
  classDef stop fill:#1C1C1E,stroke:#1C1C1E,color:#fff
  class x stop
```

<details>
<summary><b>The eleven pipeline stages, each with its guarantee and test</b></summary>

| # | Stage | What it does | How it's checked |
|---|---|---|---|
| 1 | Extract | Paged downloads from the state's open data API, with retries | Recorded real responses |
| 2 | Validate | Typed models are the data contract: a missing field, a bad date, or an unknown risk level fails the run | Contract tests on real captured records |
| 3 | Stage | Bulk copy into staging tables, one set per run | Row counts match the source |
| 4 | Transform | Upserts into the core tables; each finding joined to its visit | Join rate ≥ 95% or the run fails |
| 5 | Diff | New finding IDs, plus field changes on a daycare, become change events | A re-run creates 0 new events |
| 6 | Classify | A category from fixed rules on the state's rule number; a plain summary that only shortens the inspector's words | Checked against all 133,739 findings in the state's file: it never adds a word or a number |
| 7 | Geocode and district | Census geocoder for daycares without state coordinates; "in TX-04" only when the map point is inside the district | Real Frisco, Sherman, and Paris daycares inside, real Dallas ones outside |
| 8 | Aggregate | Refreshes area medians, district totals, and the weekly view | Totals reconcile with the core tables |
| 9 | Notify | Change events × watchers → Expo Push, batched, receipts checked, dead tokens pruned | A real push arrived on a real iPhone |
| 10 | Photos | Street photos of a center only after a person checked that each one shows that daycare | Recorded real API answers |
| 11 | Log | Counts per stage, join rate, newest source date, duration, error | The app shows "Last checked with the state" |

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/METHODS.md`](docs/METHODS.md).

</details>

<details>
<summary><b>Data model</b></summary>

```mermaid
erDiagram
  DAYCARES ||--o{ INSPECTIONS : "visited in"
  INSPECTIONS ||--o{ VIOLATIONS : "found at"
  DAYCARES ||--o{ CHANGE_EVENTS : "changed by"
  DAYCARES ||--o{ WATCHES : "watched in"
  CHANGE_EVENTS ||--o{ NOTIFICATIONS : "sent as"
  DISTRICTS ||--o{ DAYCARES : "contains by map point"
  DAYCARES {
    bigint operation_id PK
    text name
    text operation_type
    text city
    text zip
    geography geom
    bool in_district
  }
  INSPECTIONS {
    bigint activity_id PK
    bigint operation_id FK
    date activity_date
    text activity_type
    bool self_report
  }
  VIOLATIONS {
    bigint non_compliance_id PK
    bigint activity_id FK
    text standard_code
    text risk_level
    text category
    text plain
    text narrative
    date verified_date
  }
  CHANGE_EVENTS {
    bigint id PK
    bigint operation_id FK
    text kind
    jsonb before
    jsonb after
    bool is_replay
  }
  WATCHES {
    uuid user_id PK
    bigint operation_id PK
  }
  DEVICES {
    text expo_push_token PK
    uuid user_id
    text platform
  }
  NOTIFICATIONS {
    uuid user_id PK
    bigint event_id PK
    text receipt_status
  }
  DISTRICTS {
    int id PK
    text name
    geography geom
  }
```

The state's tables live in `core`, a parent's watches and devices in `app` behind row-level security, the TX-04 polygon in `geo`, and every run's counts in `ops`. Every column shown in the app and the state column it comes from: [`docs/DATA.md`](docs/DATA.md).

</details>

## What the data shows

Drawn by [`scripts/figures.py`](scripts/figures.py) from the state's own files, pulled Oct 25 2026. Each figure with its n, source, and exact SQL: [`docs/FIGURES.md`](docs/FIGURES.md).

**From the state's files to the app.** 14,977 rows in the state's operations file become 14,310 daycares in scope and 379 active inside TX-04 by map point. Of 133,739 finding rows, 118,294 are at in-scope daycares, and every one of them is joined to its visit.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/data-funnel-dark.svg">
  <img src="docs/figures/data-funnel-light.svg" alt="Counts at each step from the state's three files to what the app shows" width="100%">
</picture>

**Where the 379 are.** 234 licensed centers, one dot each, and 145 home daycares, shown only as counts per area and never as points.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/tx04-map-dark.svg">
  <img src="docs/figures/tx04-map-light.svg" alt="Map of TX-04 with one dot per active licensed center and home daycares shown only as counts per hexagon" width="100%">
</picture>

**Every month, statewide.** From Nov 2021 to Sep 2026, inspectors wrote between 1,364 and 2,523 findings a month (median 1,955), stacked here by the state's own risk level for each rule.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/findings-by-month-dark.svg">
  <img src="docs/figures/findings-by-month-light.svg" alt="Findings per month statewide, stacked by the state's risk level for the rule" width="100%">
</picture>

**What the findings were about.** Paperwork is the largest category statewide (31.1%) and in TX-04 (36.3%); safety hazards are 28.1% statewide and 22.5% in TX-04.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/categories-dark.svg">
  <img src="docs/figures/categories-light.svg" alt="Share of findings in each rule category, statewide compared with TX-04" width="100%">
</picture>

**Did the state check the fix?** Of 49,768 findings in the last 24 months, the state recorded checking the fix on 89.1%, 10.0% were fixed during the visit, and 0.8% have neither on record yet. That is why the app says "Fixed" only with one of those two.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/fix-follow-through-dark.svg">
  <img src="docs/figures/fix-follow-through-light.svg" alt="Share of findings where the state recorded checking the fix, fixed during the visit, or neither yet, by risk level" width="100%">
</picture>

**One rule, followed over time.** A Texas center must not force a child to sleep (26 TAC §746.2905(1)). The state cited it 123 times from 2022 to Q3 2026, 8 of them inside TX-04.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/nap-rule-dark.svg">
  <img src="docs/figures/nap-rule-light.svg" alt="Quarterly citations of rule 746.2905(1), TX-04 and the rest of Texas" width="100%">
</picture>

Not charted: the days between an inspection and the state posting it. It is not measured yet, so there is no figure and no estimate.

## Privacy by design

```mermaid
flowchart LR
  s["The state's record<br/>for a home daycare<br/>(name, street, city, ZIP)"] --> f["SQL function<br/>daycare_record()"]
  f -- "the street address<br/>never leaves the database" --> a["What the app shows<br/>name · city · 5-digit ZIP<br/>no aerial, no street photos,<br/>no directions"]
  classDef app fill:#FFC800,stroke:#111,color:#111
  class a app
```

- Parents sign in anonymously: no name, email, or phone number.
- A home daycare is someone's house, so the database never returns its street address: the app shows only the city and 5-digit ZIP, with no aerial or street pictures and no directions link. Database tests check this.
- A street picture of a center appears only after a person checked that it shows that daycare.
- A daycare is labelled "in TX-04" only when its map point is inside the district, never from the state's county field.

What is stored and what leaves the phone: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Tests

Details and commands: [`docs/TESTING.md`](docs/TESTING.md).

| Suite | Result |
|---|---|
| Pipeline (pytest and hypothesis) | 283 pass, 93% line coverage, ruff and `mypy --strict` clean |
| Database (pgTAP): schema, row-level security, every SQL function, home privacy | 199 pass in 12 files |
| Live API against the cloud database | 94 of 94 checks pass on Oct 26 2026: 12 SQL functions with good, empty, huge, unicode, emoji, and SQL-like input, forged tokens, and 50 calls at once ([table](docs/qa/endpoints-cloud.md)) |
| App unit (Jest) | 63 pass |
| Continuous integration | `app-ci` and `pipeline-ci` run on GitHub Actions; the badges at the top show the latest result |
| End to end | Tapping a push with the app closed or in the background opens that visit's findings (Release build, Maestro); a replayed real finding arrived as a push on a real iPhone |

## Built with

| Layer | Technology | What it does |
|---|---|---|
| App | Expo SDK 58, React Native 0.88, TypeScript, Expo Router | One codebase for iPhone, Android, and the web |
| Web | Static export hosted on Vercel | [daycare-watch.vercel.app](https://daycare-watch.vercel.app), the app inside a phone frame on a computer |
| Database | Supabase Postgres + PostGIS, row-level security | Nearest-daycare search, the TX-04 boundary, home-daycare privacy; the app reads it only through SQL functions |
| Pipeline | Python 3.12, Pydantic, GitHub Actions | Download, validate, join, diff, and notify, every morning |
| Alerts | Expo Push | One alert per new visit for each parent watching that daycare |
| Tests | pytest + hypothesis, pgTAP, Jest, Maestro | 283 pipeline, 199 database, 63 app, plus end to end |

<details>
<summary><b>Repository layout</b></summary>

| Path | What's in it |
|---|---|
| [`apps/mobile`](apps/mobile) | The Expo app: screens in `src/app`, shared UI in `src/components` |
| [`services/pipeline`](services/pipeline) | The Python pipeline (`src`), its SQL, and its tests |
| [`supabase`](supabase) | Database migrations, SQL functions, and the pgTAP tests in `supabase/tests` |
| [`packages/db`](packages/db) | Typed database client shared with the app |
| [`scripts`](scripts) | The figure builder and the web deploy |
| [`.github/workflows`](.github/workflows) | `daily-sync.yml` (the morning run), `app-ci.yml` (typecheck, lint, and Jest on every app change), and `pipeline-ci.yml` (pipeline tests on every pipeline change) |
| [`docs`](docs) | Methods, figures, data dictionary, testing, privacy, and sources |

</details>

## Run it yourself

<details>
<summary><b>Database, real data, and the app on your own machine</b></summary>

```bash
# 1. Database: Postgres + PostGIS with every migration applied
supabase start
supabase test db

# 2. Data: load the real state records (about 4 to 5 minutes the first time)
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

Pipeline commands, project structure, and the pipeline tests: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

</details>

## Roadmap

| Next | Why |
|---|---|
| Spanish | Many Texas parents read Spanish first; the summaries, tour questions, and requests should be in Spanish too |
| Every Texas district | The pipeline already loads every daycare in the state; this mostly means adding district boundaries |
| A standalone Android build | Alerts are tested on iPhone; the Expo Go app on Android cannot receive remote pushes |
| Federal rights, if they pass | If the Kairo Act or another federal law passes, its rights go next to the Texas ones |

## Sources and docs

Every legal, dataset, and district claim was checked against a primary source on Oct 25 2026. The 56 sources, each with the URL opened, and the full list of libraries, data, and services the project uses are in [`docs/SOURCES.md`](docs/SOURCES.md).

| Doc | What |
|---|---|
| [`METHODS.md`](docs/METHODS.md) | How every number is made, the pipeline in detail, and its limits |
| [`FIGURES.md`](docs/FIGURES.md) | Six data figures, each with n, source, and SQL |
| [`CONTEXT.md`](docs/CONTEXT.md) | North Texas: population growth, working parents, and child care deserts, from Census files |
| [`DATA.md`](docs/DATA.md) · [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Every field shown and its state column · system design |
| [`TESTING.md`](docs/TESTING.md) · [`QA_MATRIX.md`](docs/QA_MATRIX.md) | Every test suite and the device and endpoint matrix |
| [`DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Run it yourself, project structure, roadmap |
| [`OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md) | Verbatim quotes behind every phone number and legal line in the app |

## Team

Areeb, Aydin, Praneel, and Parth, from Texas's 4th Congressional District.

## License

[MIT](LICENSE). State records are public data from the Texas Health and Human Services Commission on data.texas.gov.
