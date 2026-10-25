# Deploying Daycare Watch

How the cloud copy is set up: the Supabase project, the nightly sync, push credentials, and the web link. Run each command from the repo root. Enter every password and token at the prompt yourself; none of them go in a file or in git.

## 1. Supabase project

| # | Command | What it does |
|---|---|---|
| 1 | `supabase login` | Opens the browser to sign in to Supabase |
| 2 | `supabase orgs list` | Shows the org id for the next step |
| 3 | `supabase projects create daycare-watch --org-id <ORG_ID> --region us-east-2` | Creates the free-tier project (Postgres 17, same as local). It prompts for a database password; keep it in a password manager |
| 4 | `supabase projects list` | Shows the new project's reference id (20 letters) |
| 5 | `supabase link --project-ref <PROJECT_REF>` | Links this repo to the project (asks for the database password) |
| 6 | `supabase db push` | Applies every file in `supabase/migrations/` to the cloud database. It does not load `seed.sql`; the pipeline backfills the real records |
| 7 | `supabase config push` | Pushes the auth settings from `supabase/config.toml`, including anonymous sign-ins |
| 8 | `supabase test db --db-url "postgresql://postgres.<PROJECT_REF>:$(security find-generic-password -s daycare-watch-db -w \| python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read().strip(),safe=""))')@aws-0-us-east-2.pooler.supabase.com:5432/postgres"` | Runs the pgTAP suite against the cloud database through the session pooler, inside a transaction that rolls back. `--linked` does not work from a Mac because the direct `db.<ref>.supabase.co` host is IPv6-only. Run it after the backfill in section 2 |
| 9 | `SUPABASE_URL=https://<PROJECT_REF>.supabase.co ANON_KEY=<anon key> supabase/snippets/api_smoke.sh` | Calls the cloud API the way the app does (public reads, anonymous sign-in, watch and unwatch) and checks that `core`, `app` and `ops` tables are not reachable. Uses only the public key. Expect `21 passed, 0 failed` |
| 10 | `SUPABASE_URL=https://<PROJECT_REF>.supabase.co ANON_KEY=<anon key> supabase/snippets/api_endpoints.sh` | Every RPC and REST path with good, empty, bad, huge and hostile input, signed out and as two users. Expect `94 passed, 0 failed` |

The app needs two values, neither of them secret: `EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co` and the anon key from `supabase projects api-keys --project-ref <PROJECT_REF>`. The `service_role` key never goes in the app, in `apps/mobile/.env.local`, or in git.

## 2. Nightly sync (GitHub Action)

| # | Step | What it does |
|---|---|---|
| 1 | Supabase dashboard → Project → Connect → Session pooler → copy the URI | The pipeline's `DATABASE_URL` (it contains the database password) |
| 2 | `gh secret set DATABASE_URL` | Paste the URI at the prompt; GitHub stores it encrypted |
| 3 | `gh secret set EXPO_ACCESS_TOKEN` | The token from expo.dev → Account settings → Access tokens |
| 4 | `gh secret set SODA_APP_TOKEN` | Optional; only needed if data.texas.gov throttles requests |

Run the first cloud backfill once from a Mac, right after `supabase db push` and before the first Action run. The pooler URL comes from `supabase/.temp/pooler-url` (written by `supabase link`, no password in it) and the password comes from the Keychain:

| # | Command | What it does |
|---|---|---|
| a | `security add-generic-password -s daycare-watch-db -a "$USER" -w` | Only if the Keychain item is missing; prompts for the database password |
| b | `(cd services/pipeline && PGPASSWORD="$(security find-generic-password -s daycare-watch-db -w)" DATABASE_URL="$(cat ../../supabase/.temp/pooler-url)" .venv/bin/python -m pipeline backfill)` | Loads the real records into the cloud database. With the local geocode cache it takes 1 to 2 minutes; the last log line shows `ok=true` and `join_rate 1.0` |

## 3. Push credentials (Expo)

| # | Command | What it does |
|---|---|---|
| 1 | `npx eas-cli login` | Signs in to Expo |
| 2 | `cd apps/mobile && npx eas-cli init` | Creates the EAS project id in `app.json` |
| 3 | `cd apps/mobile && npx eas-cli credentials` → iOS → Push Notifications: set up a new key | EAS creates the Apple push key (.p8) and stores it with Expo. Needs a paid Apple Developer membership |
| 4 | `cd apps/mobile && npx eas-cli build --profile preview --platform ios` | A TestFlight build |

## 4. Web link

`scripts/deploy-web.sh` builds the last commit against the cloud project, scans the bundle for a service key, a Mapillary token or a local address, and deploys to https://daycare-watch.vercel.app. `DRY_RUN=1` builds and scans without uploading. Then check every route:

```
apps/mobile/e2e/qa/web-routes.sh              # 20 routes + shell assets, expect 0 failed
LIGHTHOUSE=1 apps/mobile/e2e/qa/web-routes.sh # adds Lighthouse, mobile and desktop
```

## 5. Replay a real finding as a push

The phone must be signed in with notifications allowed and watching the daycare named below. `--replay-latest` takes that daycare's newest visit with findings and sends every finding from it as one push, labelled as a replay. It refuses if the daycare has no findings. Example: 1459611 (Viva World School) replays the Oct 5 2026 visit's three findings.

```
(cd services/pipeline && export PGPASSWORD="$(security find-generic-password -s daycare-watch-db -w)" \
  DATABASE_URL="$(cat ../../supabase/.temp/pooler-url)" \
  && .venv/bin/python -m pipeline sync --replay-latest <OPERATION_ID> && sleep 20 && .venv/bin/python -m pipeline receipts)
```

Expect `recipients 1`, `push_ok 1`, `push_errors 0`, then `delivered_to_provider`. Every run adds a new replay event, so it can be re-run.
