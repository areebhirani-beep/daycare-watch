#!/usr/bin/env bash
# Builds the web app against the cloud project and deploys it to https://daycare-watch.vercel.app.
#
# Needs the Supabase CLI and the Vercel CLI (via npx) logged in on this machine. The public anon
# key is fetched at build time and never written to a file. Street photos stay off on the web, so
# the Mapillary token is blanked. The build is scanned before upload and the deploy stops if it
# holds a service key, a Mapillary token, or a local address.
#
#   scripts/deploy-web.sh            # deploy the committed app (refuses uncommitted app changes)
#   ALLOW_DIRTY=1 scripts/deploy-web.sh
#   DRY_RUN=1 scripts/deploy-web.sh  # build + scan, no upload
set -euo pipefail

REF=yqrrfawmsvhxgffgrmse
ROOT=$(cd "$(dirname "$0")/.." && pwd)
APP="$ROOT/apps/mobile"

if [ -z "${ALLOW_DIRTY:-}" ] && [ -n "$(git -C "$ROOT" status --porcelain -- apps/mobile packages)" ]; then
  echo "apps/mobile has uncommitted changes; commit them or run with ALLOW_DIRTY=1" >&2
  exit 1
fi

anon=$(supabase projects api-keys --project-ref "$REF" -o json | jq -r '.[] | select(.name == "anon") | .api_key')
if [ -z "$anon" ] || [ "$anon" = null ]; then
  echo "could not fetch the anon key; run: supabase login" >&2
  exit 1
fi

echo "== export web build from $(git -C "$ROOT" rev-parse --short HEAD)"
rm -rf "$APP/dist"
(cd "$APP" && EXPO_PUBLIC_SUPABASE_URL="https://$REF.supabase.co" \
  EXPO_PUBLIC_SUPABASE_ANON_KEY="$anon" \
  EXPO_PUBLIC_MAPILLARY_TOKEN="" \
  npx expo export -p web --clear >/dev/null)

echo "== scan the bundle"
bad=0
for pattern in 'service_role' 'MLY\|' 'localhost:54321' '127\.0\.0\.1:[0-9]' '192\.168\.[0-9]+\.[0-9]+' '10\.[0-9]+\.[0-9]+\.[0-9]+:8081'; do
  if grep -rqE "$pattern" "$APP/dist"; then echo "  found $pattern"; bad=1; fi
done
grep -rq "$REF.supabase.co" "$APP/dist" || { echo "  cloud URL missing from the bundle"; bad=1; }
[ "$bad" = 0 ] || { echo "bundle scan failed; not deploying" >&2; exit 1; }
echo "  clean: cloud URL present, no service key, no Mapillary token, no local address"

# Vercel names the project after the folder, so the upload folder is called daycare-watch.
out="$(mktemp -d)/daycare-watch"
cp -R "$APP/dist" "$out"
cp "$APP/vercel.json" "$out/vercel.json"

if [ -n "${DRY_RUN:-}" ]; then
  echo "== dry run: built into $out, not uploaded"
  exit 0
fi

echo "== deploy"
(cd "$out" && npx --yes vercel deploy --prod --yes)
