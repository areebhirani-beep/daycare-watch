# Development

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

A fresh clone run this way on Oct 25 2026 loaded the same numbers as the README: 14,310 daycares and 379 inside TX-04 by map point. Without the optional download, the one test that reads the full findings file is skipped.

On a real phone, use the computer's LAN address in `EXPO_PUBLIC_SUPABASE_URL` instead of `127.0.0.1`.

## Pipeline commands

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
| Spanish | Many Texas parents read Spanish first; the summaries and the rights requests should be in Spanish too |
| Any Texas district, not only TX-04 | The pipeline already loads the whole state; only the district boundary is TX-04 |
| Federal rights, if a federal law passes | Add its rights next to the Texas ones |
