#!/usr/bin/env bash
# Builds the web app against the cloud project and deploys it to https://daycare-watch.vercel.app.
#
# Builds the last commit (HEAD) in a temporary worktree, so uncommitted edits never ship.
# Needs the Supabase CLI and the Vercel CLI (via npx) logged in on this machine. The public anon
# key is fetched at build time and never written to a file. Street photos stay off on the web, so
# the Mapillary token is blanked. The build is scanned before upload and the deploy stops if it
# holds a service key, a Mapillary token, or a local address.
#
#   scripts/deploy-web.sh
#   DRY_RUN=1 scripts/deploy-web.sh  # build + scan, no upload
set -euo pipefail

REF=yqrrfawmsvhxgffgrmse
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SHA=$(git -C "$ROOT" rev-parse --short HEAD)

anon=$(supabase projects api-keys --project-ref "$REF" -o json | jq -r '.[] | select(.name == "anon") | .api_key')
if [ -z "$anon" ] || [ "$anon" = null ]; then
  echo "could not fetch the anon key; run: supabase login" >&2
  exit 1
fi

work=$(mktemp -d)
trap 'git -C "$ROOT" worktree remove --force "$work/src" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
git -C "$ROOT" worktree add -q --detach "$work/src" HEAD
# An APFS clone of the installed packages: seconds, and no network install.
cp -Rc "$ROOT/node_modules" "$work/src/node_modules" 2>/dev/null || cp -R "$ROOT/node_modules" "$work/src/node_modules"
# npm nests a package in the app's own node_modules when its version differs from the root's.
if [ -d "$ROOT/apps/mobile/node_modules" ]; then
  cp -Rc "$ROOT/apps/mobile/node_modules" "$work/src/apps/mobile/node_modules" 2>/dev/null \
    || cp -R "$ROOT/apps/mobile/node_modules" "$work/src/apps/mobile/node_modules"
fi
APP="$work/src/apps/mobile"

echo "== export web build from $SHA"
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
out="$work/daycare-watch"
cp -R "$APP/dist" "$out"
cp "$APP/vercel.json" "$out/vercel.json"

if [ -n "${DRY_RUN:-}" ]; then
  echo "== dry run: built $SHA and scanned it, not uploaded"
  exit 0
fi

echo "== deploy $SHA"
(cd "$out" && npx --yes vercel deploy --prod --yes)
