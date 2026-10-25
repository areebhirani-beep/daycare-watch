#!/usr/bin/env bash
# Rebuilds assets/fonts/MaterialSymbols_400Regular.subset.ttf: the web's icon font cut down to the icons the app uses
# (the android names in src/components/ui/Glyph.tsx and src/components/Icon.tsx). Run it after adding an icon.
# Needs uv (fonttools runs through uvx; nothing is added to the project).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=../..
codes=$(python3 - "$ROOT" <<'PY'
import json, re, sys
root = sys.argv[1]
names = []
for p in ('src/components/ui/Glyph.tsx', 'src/components/Icon.tsx'):
    names += re.findall(r"android:\s*'([a-z0-9_]+)'", open(p).read())
symbols = json.load(open(f'{root}/node_modules/expo-symbols/build/android/symbols.json'))
missing = [n for n in names if n not in symbols]
if missing:
    sys.exit(f'not Material Symbols names: {missing}')
print(','.join('U+%04X' % c for c in sorted({symbols[n] for n in names})))
PY
)
uvx --from fonttools pyftsubset "$ROOT/node_modules/@expo-google-fonts/material-symbols/400Regular/MaterialSymbols_400Regular.ttf" \
  --unicodes="$codes" --layout-features='' --no-hinting --output-file=assets/fonts/MaterialSymbols_400Regular.subset.ttf
echo "icons: $(echo "$codes" | tr ',' '\n' | wc -l | tr -d ' ') -> $(wc -c < assets/fonts/MaterialSymbols_400Regular.subset.ttf | tr -d ' ') bytes"
