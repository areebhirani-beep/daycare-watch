# Owner steps (things only the account owner can do)

Run each command from the repo root in the Claude Code prompt with the `!` prefix, so the
output lands in the session. Enter every password and token yourself when prompted; never
paste one into a chat, a file, or git.

## 1. Supabase cloud project (Saturday night)

| # | Command | What it does |
|---|---|---|
| 1 | `! supabase login` | Opens the browser to sign in to Supabase |
| 2 | `! supabase orgs list` | Shows your org id for the next step |
| 3 | `! supabase projects create daycare-watch --org-id <ORG_ID> --region us-east-2` | Creates the free-tier project (Postgres 17, same as local). It prompts for a database password: make one up, store it in your password manager |
| 4 | `! supabase projects list` | Shows the new project's **reference id** (20 letters) |
| 5 | `! supabase link --project-ref <PROJECT_REF>` | Links this repo to the project (asks for the database password) |
| 6 | `! supabase db push` | Applies every file in `supabase/migrations/` to the cloud database. Does **not** load `seed.sql`; the pipeline backfills real data |
| 7 | `! supabase config push` | Pushes the auth settings from `supabase/config.toml`, including **anonymous sign-ins = on** |
| 8 | (after the first cloud backfill in section 2) `! supabase test db --linked` | Runs the pgTAP suite against the cloud database (rolls back, changes nothing). It needs the real records loaded first |

Then tell `integrator` the project ref. platform turns it into these values (none of them are secret):
- mobile: `EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co` and the **publishable/anon key** from `! supabase projects api-keys --project-ref <PROJECT_REF>`
- Never put the `service_role` / secret key in the app, in `.env.local` for mobile, or in git.

## 2. Pipeline secrets for the daily GitHub Action

| # | Command | What it does |
|---|---|---|
| 1 | Dashboard → Project → **Connect** → *Session pooler* → copy the URI | The pipeline's `DATABASE_URL` (it contains your DB password) |
| 2 | `! gh secret set DATABASE_URL` | Paste the URI at the prompt; it is stored encrypted in GitHub |
| 3 | `! gh secret set EXPO_ACCESS_TOKEN` | Paste the token from expo.dev → Account settings → Access tokens |
| 4 | `! gh secret set SODA_APP_TOKEN` | Optional; only if data.texas.gov throttles us |

Then run the first cloud backfill once from your Mac:
`! DATABASE_URL="$(pbpaste)" python -m pipeline backfill` (with the pooler URI on the clipboard, run from `services/pipeline`).

## 3. Expo / EAS and push credentials

| # | Command | What it does |
|---|---|---|
| 1 | `! npx eas-cli login` | Signs in to Expo |
| 2 | `! cd apps/mobile && npx eas-cli init` | Creates the EAS project id in `app.json` |
| 3 | `! cd apps/mobile && npx eas-cli credentials` → iOS → **Push Notifications: set up a new key** | EAS creates the Apple push key (.p8) in your Apple Developer account and stores it with Expo. Needs the paid Apple Developer membership |
| 4 | Firebase console → new project → add Android app with the package name from `app.json` → download `google-services.json` | FCM is used only as Android push transport. Keep `google-services.json` out of git |
| 5 | `! cd apps/mobile && npx eas-cli credentials` → Android → **Google Service Account / FCM V1** → upload the service-account JSON from Firebase → Project settings → Service accounts | Lets Expo deliver pushes to Android |
| 6 | `! cd apps/mobile && npx eas-cli build --profile preview --platform all` | TestFlight + Android internal builds (mobile owns the profiles) |

## Checklist to send back to integrator
- [ ] Project ref: ________
- [ ] `supabase db push` ok, `supabase test db --linked` ok
- [ ] `gh secret list` shows DATABASE_URL, EXPO_ACCESS_TOKEN
- [ ] EAS project id created; iOS push key and Android FCM credential set
