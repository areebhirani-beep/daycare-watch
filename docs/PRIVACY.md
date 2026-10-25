# Privacy

Daycare Watch is built so a parent can use it without telling us who they are. This page lists everything the app stores, everything it sends, and the rules that protect the people in the state records. Each line points at the code that makes it true.

## What we store about a parent

| Data | Where | Why | Code |
|---|---|---|---|
| An anonymous account ID (no name, email, or phone) | Supabase Auth | So watches and alerts belong to one phone | `apps/mobile/src/lib/supabase.ts` (`signInAnonymously`) |
| The daycares the parent watches | `app.watches` (user ID, daycare ID, time) | To know whom to alert | `supabase/migrations/20261024210200_app_geo_ops_staging.sql` |
| The phone's push token and platform | `app.devices` | To deliver alerts through Apple or Google | same migration; `apps/mobile/src/lib/notifications.ts` |
| Which alerts were sent | `app.notifications` (user ID, event ID, Expo ticket and receipt) | So nobody gets the same alert twice | same migration; `services/pipeline/src/pipeline/notify.py` |

Row-level security limits every `app.*` row to its owner. The app never reads tables directly; it calls RPC functions, and `my_watches` is not callable without a signed-in session. **Start over** in the app stops every watch, starts a fresh anonymous ID, and forgets the saved spot and onboarding on the phone (`startOver` in `apps/mobile/src/lib/api.ts`). If an anonymous account is ever deleted, its watches, devices, and sent-alert rows go with it (`on delete cascade`).

## What stays on the phone

| Data | Key | Notes |
|---|---|---|
| Whether onboarding is done | `onboarded.v1` | |
| The last position used for "near you" | `last-position` | Kept on the phone only, so the list can load before location answers |
| The anonymous session | Supabase auth storage | |

## What leaves the phone

| Sent to | What | When |
|---|---|---|
| Supabase (our database) | A latitude and longitude, to list nearby daycares | Each time the home list loads. `daycares_near` is a read-only query and stores nothing |
| Supabase | Search text | Each search |
| Expo Push, then Apple (APNs) or Google (FCM) | The push token and the alert text | Only after the parent turns on alerts |
| Esri | Map tile requests around a daycare | When a place page shows its map |
| Apple Maps (iPhone) or Google Maps (Android) | Map and 3D-view tile requests around a daycare | When a place page shows its map or 3D view |
| Mapillary | Nothing. Street photos are collected by the pipeline but not shown in the app | Never |
| Apple Maps or Google Maps | The daycare's address line from the state record | Only when the parent taps a map button |

Location permission is optional. Without it the app starts from Frisco, inside TX-04. The web link never asks for location.

## Protecting the people in the records

| Rule | How it is enforced |
|---|---|
| Home daycares (licensed, registered, and listed homes) show city and 5-digit ZIP only (never the ZIP+4): no street address, no aerial or street imagery, no directions link | Place page and list rows; `core.daycare_rows` returns `left(zip, 5)` for homes (migration `20261025110000_home_zip5.sql`; pgTAP `011_home_privacy`); `daycare_record` returns no photos for anything but a Licensed Center |
| Public test fixtures replace a home's street with "withheld for privacy" and round its point to 2 decimals | `services/pipeline/fixtures/` (Census geocoder recordings, district test points) and the database seed |
| Street photos (collected by the pipeline, not shown in the app) are fetched only for Licensed Centers with an exact address match, never for homes or approximate points. A photo older than the daycare's permit or more than 6 years old is dropped, so it can't show a different business | `services/pipeline/src/pipeline/photos.py` (`TARGETS`), and the `daycare_record` filter (pgTAP test 009) |
| Map links send the state's address line, not our estimated point | The geocode sits along the street's address range, not on the rooftop |
| The app never labels a daycare safe, unsafe, scored, graded, or ranked | Copy review plus tests on alert text (`services/pipeline/tests/test_notify.py`) |
| Findings are shown in the inspector's own words, with a plain summary that only shortens them | `services/pipeline/src/pipeline/classify.py`; a property test checks the summary adds no numbers, and a full-dataset test checks it adds no words |

## What we do not do

- No ads, no analytics SDK, no tracking across apps.
- No names, emails, or phone numbers collected from parents.
- No selling or sharing of watch lists.
- No data that isn't from the state's public records, the U.S. Census geocoder, public map imagery (Esri, Apple, Google), or the parent's own choices.

## Questions

Open an issue on this repository. To report a concern about a daycare, use the state's channels in [`OFFICIAL_SOURCES.md`](OFFICIAL_SOURCES.md), not this project.
