#!/usr/bin/env bash
# QA for the live web link: every route must answer 200 text/html on a cold open (the same request a refresh or a
# pasted deep link makes), static assets must load, and an unknown path must still get the app (it shows its own
# not-found screen). LIGHTHOUSE=1 also scores /, a place page and Your rights, mobile and desktop.
#   e2e/qa/web-routes.sh                       # https://daycare-watch.vercel.app
#   WEB=http://localhost:5055 e2e/qa/web-routes.sh
set -uo pipefail
WEB=${WEB:-https://daycare-watch.vercel.app}
OUT=${OUT:-$(cd "$(dirname "$0")/../../../.." && pwd)/harness/state/qa/web}
mkdir -p "$OUT"

routes=(/ /onboarding /onboarding/how /onboarding/find /onboarding/alerts /onboarding/done
  /pulse /rights /watching /search /week /categories /report
  /daycare/1459611 /daycare/1459611/tour /daycare/1459611/watch /daycare/94796 /alert/665
  "/search?q=Montessori" /this-page-does-not-exist)

pass=0; fail=0
echo "Routes on $WEB"
for r in "${routes[@]}"; do
  got=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$WEB$r")
  if [[ "$got" == "200 text/html"* ]]; then v=ok; pass=$((pass + 1)); else v=FAIL; fail=$((fail + 1)); fi
  printf '  %-4s %-28s %s\n' "$v" "$r" "$got"
done

# Every script and asset the shell references must load.
html=$(curl -s "$WEB/")
for a in $(grep -oE '(src|href)="/[^"]+"' <<<"$html" | sed -E 's/^(src|href)="//; s/"$//' | sort -u); do
  got=$(curl -s -o /dev/null -w '%{http_code}' "$WEB$a")
  if [[ "$got" == 200 ]]; then v=ok; pass=$((pass + 1)); else v=FAIL; fail=$((fail + 1)); fi
  printf '  %-4s %-28s %s\n' "$v" "${a:0:28}" "$got"
done

if [[ -n "${LIGHTHOUSE:-}" ]]; then
  echo "Lighthouse (performance accessibility best-practices seo)"
  for r in / /daycare/1459611 /rights; do
    for form in mobile desktop; do
      f="$OUT/lh-$form$(tr '/' '_' <<<"$r").json"
      preset=(); [[ "$form" == desktop ]] && preset=(--preset=desktop)
      npx -y lighthouse@12.2.1 "$WEB$r" --quiet --chrome-flags="--headless=new" ${preset[@]+"${preset[@]}"} \
        --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="$f" >/dev/null 2>&1
      printf '  %-8s %-18s %s\n' "$form" "$r" "$(jq -r 'if .runtimeError then "ERROR \(.runtimeError.code)" else
        [.categories[] | "\(.id | split("-") | map(.[0:1]) | join(""))=\((.score * 100) | round)"] | join(" ") end' "$f")"
    done
  done
fi

echo "Result: $pass passed, $fail failed"
[[ "$fail" == 0 ]]
