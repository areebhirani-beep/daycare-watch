#!/usr/bin/env bash
# Serves the app to a real iPhone in Expo Go, against the cloud project, so the phone can register for alerts and
# receive a replayed push. Production JS (--no-dev --minify): no warning boxes or dev overlays.
# Needs the Supabase CLI logged in on this Mac; the public anon key is fetched here and never written to a file.
# Scan the QR it prints with the iPhone's Camera. Stop any other server on port 8081 first.
#
#   bash apps/mobile/scripts/phone.sh
set -euo pipefail

REF=yqrrfawmsvhxgffgrmse
anon=$(supabase projects api-keys --project-ref "$REF" -o json | jq -r '.[] | select(.name == "anon") | .api_key')
if [ -z "$anon" ] || [ "$anon" = null ]; then
  echo "could not fetch the anon key; run: supabase login" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
# Variables already set here win over .env.local, so the phone talks to the cloud, not the local stack.
EXPO_PUBLIC_SUPABASE_URL="https://$REF.supabase.co" EXPO_PUBLIC_SUPABASE_ANON_KEY="$anon" \
  exec npx expo start --go --lan --port 8081 --no-dev --minify --clear
