<div align="center">

<img src="docs/logo.png" width="88" alt="Daycare Watch app icon">

# Daycare Watch

**See what Texas state inspectors found at a daycare, in plain English, and get an alert when the state posts something new.**

### [Try it: daycare-watch.vercel.app](https://daycare-watch.vercel.app)
No sign-in. Real Texas state records. Works on any phone or computer.

[![Pipeline CI](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/pipeline-ci.yml/badge.svg)](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/pipeline-ci.yml)
[![Daily sync](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/daily-sync.yml/badge.svg)](https://github.com/areebhirani-beep/daycare-watch/actions/workflows/daily-sync.yml)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/hero-dark.png">
  <img src="docs/screenshots/hero-light.png" alt="Daycare Watch: nearby daycares, a daycare's state record, and the alert for a new state finding" width="100%">
</picture>

Built for the **2026 Congressional App Challenge, Texas's 4th District**

</div>

## Why we built this

This app is personal to us: one of us was moved to a better daycare as a kid over things that seemed small at the time, like being made to nap when already too old for it. One place the warning signs can show up is in the reports state inspectors write after they visit a daycare, and Texas already makes those reports public, but they sit on a search website that you have to know about and go through one daycare at a time. We know the app cannot detect or prevent anything that happens at a daycare; what it does is make the reports the state already writes easier for a parent to find, understand, and act on.

The app never calls a daycare safe or unsafe, and never scores, grades, or ranks one. It shows what the state found, when, and whether the state has checked the fix.

## Try it in 30 seconds

1. Open **[daycare-watch.vercel.app](https://daycare-watch.vercel.app)** on any phone or computer.
2. Search a name, city, or ZIP in TX-04, for example `Montessori`, `Rockwall`, or `75034`.
3. Open a daycare: its latest state visit in plain English, each finding with the inspector's own words, and a link to the official state record.
4. On that daycare's page, tap **Your rights**: the three requests Texas law already gives parents (your child's records, a drop-in visit, incident video), written and ready to send.

On the iPhone app, **Watch this daycare** turns on a push alert for the next time the state posts something about it.

| Find | A daycare's record | Every finding |
|:-:|:-:|:-:|
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/02-search.png"><img src="docs/screenshots/framed/light/02-search.png" width="240" alt="Search by name, city, or ZIP"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/03b-place-history.png"><img src="docs/screenshots/framed/light/03b-place-history.png" width="240" alt="State visits over the past two years"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/04-findings.png"><img src="docs/screenshots/framed/light/04-findings.png" width="240" alt="Each finding with the inspector's words and fix status"></picture> |
| **Your rights** | **Watch** | **Tour questions** |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/05-rights.png"><img src="docs/screenshots/framed/light/05-rights.png" width="240" alt="Ready-to-send requests under Texas law"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/06-watch.png"><img src="docs/screenshots/framed/light/06-watch.png" width="240" alt="Turning on alerts for a daycare"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/framed/dark/08-tour.png"><img src="docs/screenshots/framed/light/08-tour.png" width="240" alt="Tour questions built from this daycare's own findings"></picture> |

## How it works

The state publishes three open datasets on data.texas.gov: daycares, visits, and findings. Each morning a GitHub Action downloads all three, checks every row against a typed data contract, joins each finding to the visit it came from (the run fails below 95%; it has been 100% on every run), and compares them with the day before. Anything new at a daycare a parent watches becomes one push alert per visit. The app reads the database only through a small set of SQL functions.

```mermaid
flowchart LR
  TX["data.texas.gov<br/>daycares · visits · findings"] --> P["Pipeline (Python, daily)<br/>validate → join → diff → plain summary"]
  CEN["Census geocoder<br/>and TX-04 boundary"] --> P
  P --> DB["Postgres + PostGIS<br/>(Supabase)"]
  P -- "new finding × watchers" --> PUSH["Expo Push"] --> APP["iPhone app and web"]
  APP -- "SQL functions only" --> DB
```

The plain-English summary only shortens the inspector's first sentence; a test over all 133,739 findings in the state's file checks that it never adds a word or a number. Each stage, its guarantee, and its test are in [`docs/METHODS.md`](docs/METHODS.md).

## What the data shows

Drawn by [`scripts/figures.py`](scripts/figures.py) from the state's own files, pulled Oct 25 2026. All six figures, with n, source, and the exact SQL: [`docs/FIGURES.md`](docs/FIGURES.md).

**Where the 379 are.** At least 379 active daycares sit inside TX-04 by map point: 234 licensed centers (one dot each) and 145 home daycares, shown only as counts per area, never as points.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/tx04-map-dark.svg">
  <img src="docs/figures/tx04-map-light.svg" alt="Map of TX-04 with one dot per active licensed center and home daycares shown only as counts per hexagon" width="100%">
</picture>

**Did the state check the fix?** Of 49,768 findings in the last 24 months, the state recorded checking the fix on 89.1%, 10.0% were fixed during the visit, and 0.8% have neither on record yet. That is why the app says "Fixed" only with one of those two.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/fix-follow-through-dark.svg">
  <img src="docs/figures/fix-follow-through-light.svg" alt="Share of findings where the state recorded checking the fix, fixed during the visit, or neither yet, by risk level" width="100%">
</picture>

**The nap rule.** A Texas center must not force a child to sleep (26 TAC §746.2905(1)). The state cited it 123 times from 2022 to Q3 2026, 8 of them inside TX-04.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/nap-rule-dark.svg">
  <img src="docs/figures/nap-rule-light.svg" alt="Quarterly citations of rule 746.2905(1), TX-04 and the rest of Texas" width="100%">
</picture>

## Tests

Run on Oct 25 2026. Details and commands: [`docs/TESTING.md`](docs/TESTING.md).

| Suite | Result |
|---|---|
| Pipeline (pytest and hypothesis) | 283 pass, 93% line coverage, ruff and `mypy --strict` clean |
| Database (pgTAP): schema, row-level security, every SQL function, home privacy | 195 pass in 12 files |
| Live API against the cloud database | 94 of 94 endpoint checks pass |
| App unit (Jest) | 63 pass |
| End to end | Tapping a push with the app closed or in the background opens that visit's findings (Release build, Maestro); a replayed real finding arrived as a push on a real iPhone |

## Privacy

- Parents sign in anonymously: no name, email, or phone number.
- Home daycares show only the city and 5-digit ZIP: no street, no map of the house, no photos.
- A street picture of a center appears only after a person checked that it shows that daycare.
- A daycare is labelled "in TX-04" only when its map point is inside the district, never from the state's county field.

What is stored and what leaves the phone: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Sources and docs

Every legal, dataset, and district claim was checked against a primary source on Oct 25 2026. The 56 sources, each with the URL opened, and the full list of libraries, data, and services the project uses are in [`docs/SOURCES.md`](docs/SOURCES.md).

| Doc | What |
|---|---|
| [`METHODS.md`](docs/METHODS.md) | How every number is made, the pipeline in detail, and its limits |
| [`FIGURES.md`](docs/FIGURES.md) | Six data figures, each with n, source, and SQL |
| [`CONTEXT.md`](docs/CONTEXT.md) | North Texas: population growth, working parents, and child care deserts, from Census files |
| [`DATA.md`](docs/DATA.md) · [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Every field shown and its state column · system design |
| [`DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Run it yourself, project structure, roadmap |
| [`OFFICIAL_SOURCES.md`](docs/OFFICIAL_SOURCES.md) | Verbatim quotes behind every phone number and legal line in the app |

## Team

Areeb, Parth, Praneel, and Aydin, from Texas's 4th Congressional District.

## License

[MIT](LICENSE). State records are public data from the Texas Health and Human Services Commission on data.texas.gov.
