# Daycare Watch

Texas inspects every licensed daycare and publishes what it finds, but almost no parent ever sees it. Daycare Watch shows parents a daycare's state inspection record in plain English, alerts them when the state posts a new violation at their child's daycare, and explains the rights Texas parents already have under the Kairo and the Kids' Law (SB 1098, 2023).

Built for the 2026 Congressional App Challenge, Texas's 4th District.

## Data
All facts come from Texas Health and Human Services Child Care Regulation open data on [data.texas.gov](https://data.texas.gov): operations (`bc5r-88dy`), inspections (`m5q4-3y3d`), violations (`tqgd-mf4x`), and abuse/neglect investigation totals (`txmx-ceda`). The app never grades or rates a daycare. It shows what the state found, when, and whether it was fixed.

## Layout
| Path | What |
|---|---|
| `apps/web` | The parent app (installable web app) |
| `services/sync` | Daily data sync, district filter, plain-language summaries, alerts |
| `firebase` | Firestore rules, indexes, hosting, emulator config |
| `packages/shared` | Shared types |
