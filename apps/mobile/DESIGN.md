# Daycare Watch — design system v2

**One line:** a map app, not a document. The map gives the color, the type is the native grotesk set heavy and big, every number is huge and tabular, and the record strip is the one picture people remember.

The v1 direction (Newsreader serif, paper beige, text stacks) is retired. Nothing from it survives.

---

## 1. Reference board (structure we copy, not branding)

| App | Pattern we take | Measurements we use |
|---|---|---|
| **Google Maps** | Full-bleed map; floating search pill over it; filter chip row under the pill; place sheet: hero image, huge name, info chips, action-button row, tabs | Search pill 52 high, full radius, 16 side inset, shadow y2 blur 12 @ 12%. Chips 36 high, full radius, 14 horizontal padding, 8 gap, horizontal scroll with no indicator. Action row: equal pills, 40 high, icon + label |
| **Uber** | Black/white confidence; one accent; bold headers; sticky bottom action bar; map with a sheet that springs | Headline 28–34 / 800, tracking −0.6. Bottom bar: 56 button + 16 padding + safe area, hairline top border, surface bg. Sheet spring damping 24, stiffness 260 |
| **DoorDash** | Store card: big image on top, bold name, one meta row; horizontal carousels; dense clean list | Carousel card 280 wide, image 2:1 (280×140), radius 16 image + card, name 17/700, meta 14/500 grey, 12 gap between cards, 16 peek of the next card. List row 76 high, 56 thumbnail radius 12 |
| **Apple Maps** | Sheet physics and detents; blur only over the map; place card layout | Detents: peek 156 + bottom inset, half 60%, full = screen − top inset − 8. Grabber 36×5, 6 from top, radius 3. Sheet top radius 28. Blur (`systemChromeMaterial`) only on chrome that floats over the map |
| **Duolingo** | Onboarding: progress bar on top, one decision per screen, chunky 3D buttons, haptics, a celebration | Progress bar 14 high, radius 7, fills with a spring. Button 56 high, radius 16, 4 pt bottom edge in a darker shade; press = face drops 4, edge goes to 0, light impact haptic. Celebration: burst + success haptic + big headline |
| **Cal AI** | Huge confident numerals; progress rings; card stacks for stats | Numeral 56/800 tabular, tracking −1.5, label above in 13/600 grey. Stat cards radius 22, 16 padding, grouped-grey fill, 2-up grid with 10 gap. Ring 64 diameter, 7 stroke, round caps |
| **Brilliant / Headspace / Calm** | Crisp geometric visuals; soft color fields; purposeful motion | Soft fields = accent at 8–12% under hero numbers. Entrances 220 ms ease-out, 30 ms stagger. Nothing loops |

### 1b. Real reference screenshots (App Store listings, `harness/state/refs/`)

| Ref file | What is on it | What we copy, exactly | Where it lands |
|---|---|---|---|
| `uber-3.png` | Map with route, white floating back button, bottom sheet "Confirm details", full-width **black** "Confirm UberX" + grey square side button | Sheet with centered bold title; black full-width CTA (56, radius 12) with a grey square secondary beside it; white circular floating button top-left over the map | Home sheet; place page sticky bar ("Watch this daycare" black + share square) |
| `uber-4.png` | Uber Eats home: grey-selected chips, "National favorites" + round grey arrow, carousel of cards (image, name, one meta line), floating pill tab bar | Chip row (selected = filled); section header = bold 20 title + 36 round grey arrow; carousel card image ≈1.8:1, radius 12, name 17/600, one meta line | Home half detent: "Near you →" carousel of `DaycareCard` |
| `doordash-3.png` | Search results: full-width store card, big photo, bold name + heart, "4.5★ (200+) · 3.3 km · 30 min" | Full-width card: image on top radius 12, bold name with a right-aligned toggle icon, one dotted meta row. **We swap the heart for a bell (watch) and the star rating for the record strip** | Home full detent list; search results |
| `doordash-4.png` | Browse: big bold "Browse" title, grey search field, 2-col grey tiles | Large left-aligned title over a grey search field | Onboarding "Find your daycare"; Rights tab title. (Its 2-col tile grid is **not** used: identical tiles read as generated, see §8) |
| `googlemaps-4.png` | Map top, sheet with grabber and title row (icon + "Ask Maps" + round grey icon buttons), floating white locate button bottom-right | Grabber 36×5; sheet title row with round grey 36 icon buttons on the right; locate button white circle riding above the sheet edge | Home sheet header; place sheet close/share |
| `googlemaps-5.png` | Stack of white circular floating buttons on the right, white sticky bottom panel | 48 white circles with shadow stacked 12 apart on the right edge | Home locate + list/map toggle |
| `ubereats-2.png` | Chip row with emoji glyphs, bell top-right | Bell in the top-right of a home header = alerts entry | Home header bell → Watching |

**Copy rule from the refs:** a card is a name, one meta line and one picture. No explainer paragraphs, no sparkle/"AI" badges, no filler. Details sit one tap deeper.

## 2. Proposal (locked)

| Axis | Decision | Why |
|---|---|---|
| Aesthetic | **Map-native utility**: Uber contrast, Google Maps structure, Cal AI numbers | The data is serious; the app should feel as sure-footed as the apps parents already trust daily |
| Type | **SF Pro (iOS) / Roboto (Android)** via `Platform.select`. Titles 700–800, tight tracking. Every number tabular | Owner decision. The native face reads "real app" instantly; weight and size carry the character, not a novelty font |
| Color | White + neutral greys, true black dark mode. **Every action is ink** (Uber). **One signal color: school-bus yellow `#FFC800`** (dark `#FFD21F`), used only for watching and alerts | Cobalt was v2's first pick and was dropped on Oct 24: blue is the default "internet blue" of generated UI. Yellow is the color every parent already reads as "kids are on the move", it can't be mistaken for a rating (not green, not red), and the ember record keeps all the warm reds to itself. It is a fill only, always with ink on top (yellow on white is 1.55:1) |
| Record color | A **single-hue ember ramp**, light to deep, ordinal by rule risk | One hue = an ordinal scale, not a traffic light. No green anywhere, so nothing reads as a pass |
| Layout | Map first. Sheets, cards, carousels. Content never sits on a bare page | Fixes "looks like a document" at the root |
| Depth | Three levels: flat, card, floating. Shadows only on things that float over the map | Map apps use depth to say "this floats"; everything else stays flat |
| Motion | Springs on sheets and presses, short fades for content, Reduce Motion respected | Motion explains where things came from; it never decorates |
| Haptics | `select` on chips/tabs, `press` on 3D buttons, `success` when watching starts | Duolingo-grade tactility on the moments that matter |

**Safe choices:** native grotesk, Google Maps layout, white/grey surfaces. Parents know how to use this on first sight.
**Risks we take:** (1) the record strip is the hero image of every daycare, not a chart buried in a tab; (2) huge 56-pt numerals for plain counts, never a score; (3) Duolingo 3D buttons in a civic app, which makes a government dataset feel touchable.

## 3. Tokens (`src/theme/tokens.ts`)

### Type (all `fontFamily` = system; iOS switches Text/Display optically at 20 pt)
| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `numeral` | 56 / 60 | 800 | −1.5 | Cal AI numbers on the place page |
| `display` | 34 / 38 | 800 | −0.8 | Daycare name on the place page, onboarding headlines |
| `largeTitle` | 28 / 32 | 800 | −0.6 | Screen titles, sheet title at full detent |
| `title` | 22 / 27 | 700 | −0.4 | Section heads, card stacks |
| `headline` | 17 / 22 | 700 | −0.2 | Card names, list names, buttons |
| `body` | 17 / 24 | 400 | −0.2 | Plain-English summaries |
| `callout` | 15 / 20 | 500 | −0.1 | Meta rows, chip labels |
| `subhead` | 15 / 20 | 600 | −0.1 | Small labels with weight |
| `footnote` | 13 / 18 | 500 | 0 | Dates, sources, "Last checked" |
| `caption` | 12 / 16 | 600 | 0 | Axis labels, map attribution |
Android: same sizes on `sans-serif` (Roboto) with numeric weights. Roboto Flex as a loaded variable font maps weights unreliably in React Native, so the shipped Android face is system Roboto.

### Color
| Token | Light | Dark | Contrast note |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#000000` | |
| `surface` (cards, sheet) | `#FFFFFF` | `#141416` | |
| `sunken` (grouped fill, stat cards, chips) | `#F2F2F4` | `#1F1F22` | |
| `text` | `#0B0B0C` | `#F5F5F7` | 17.6+ |
| `textSecondary` | `#5C5C66` | `#A8A8B2` | 5.9+ on sunken |
| `textTertiary` | `#6E6E78` | `#8C8C96` | 4.5 on sunken (AA floor) |
| `accent` (links, strokes, rings, selected marks) | `#0B0B0C` (ink) | `#FFD21F` | 19.7 on white / 11.3 on sunken |
| `onAccent` | `#FFFFFF` | `#000000` | |
| `accentSoft` (highlighter wash: selected row, check discs) | `#FFF6C9` | `#2A2300` | text 18.1 / 14.4 |
| `signal` (fills only: watched pin, bell toggle, alerts button, celebration) | `#FFC800` | `#FFD21F` | ink on it 12.7 / 14.5 |
| `onSignal` | `#0B0B0C` | `#000000` | |
| `signalEdge` (3D bottom edge) | `#D19E00` | `#A88200` | |
| `ink` (black button, selected chip, pins) | `#0B0B0C` | `#F5F5F7` | |
| `risk.High → Low` | `#7E1A0D #A2361A #BF5A2A #AA7658 #8C837D` | `#FF9C80 #E8866A #C97A5C #A3857A #7F7874` | every step ≥ 3:1 on its surfaces (graphics) |

### Space, radius, elevation, motion
| | Values |
|---|---|
| Space (4-pt) | 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 |
| Radius | chip/pill 999 · thumb 12 · button 16 · card 16 · stat card 22 · sheet 28 |
| Elevation | `card`: y1 blur 3 @ 6% + hairline · `float`: y4 blur 16 @ 14% (search pill, locate, pins) · `sheet`: y−4 blur 24 @ 10% |
| Springs | `sheet` damping 24 / stiffness 260 · `press` damping 18 / stiffness 500 · `pop` damping 12 / stiffness 220 (celebration, selected pin) |
| Durations | fast 150 · base 220 · slow 360 · stagger 30 |
| Haptics | `select` = selectionAsync · `press` = impact Light · `heavy` = impact Medium (watch toggle) · `success` = notification Success |

## 4. Primitives (`src/components/ui/`)

| Component | What it is |
|---|---|
| `Text` | The one text primitive; variants above; `tabular` on by default for `numeral`, auto max scale per variant |
| `Button` | Duolingo 3D: face + 4-pt edge. Kinds `ink` (Uber black, **the main CTA everywhere**: Watch, Continue), `primary` (school-bus yellow: "Turn on alerts" and the "Watching · alerts on" state only), `secondary` (white + grey edge), `plain`. 56 high, radius 16 |
| `Chip` | Filter chip (toggle, selected = ink fill) and `InfoChip` (icon + label on sunken) |
| `SearchPill` / `FloatButton` | Floating chrome over the map, `float` elevation |
| `DaycareCard` | DoorDash card: map hero 2:1, bold name, meta row, compact record strip |
| `PlaceRow` | Dense list row: 64 aerial thumb (credit "© Esri"), name, meta, compact strip |
| `MapSnapshot` | The hero image: a real **aerial photo** of the daycare's location with our pin (Esri World Imagery tiles, no key). **The Esri credit shows on every image**: full line on cards and heroes (lifted above the place page's head card), "© Esri" on thumbnails. Tiles load on view only, never prefetched. Tile mosaic in `expo-image`, fetched one zoom deeper for retina. No native module, works in Expo Go and in carousels. (CARTO was tried first: it now returns an "API key required" placeholder.) |
| `MapPin` / `ClusterBubble` | Uniform ink pin (white core), watched = yellow disc with ink bell and ink ring; cluster = ink circle + tabular count |
| `StatBand` / `RingCard` / `Ring` | Three counts in an open band with hairlines (no boxes); one wide card with a 92-pt ring for "verified fixed by the state". A ring shows a share of findings, never a rating. `NumberCard` stays for single stats; never a grid of identical cards |
| `RightCard` | One right, one tap: icon disc, bold title, one-line detail, opens the generated request |
| `Tabs` | Google Maps place-sheet tabs, underline indicator springs between tabs |
| `SheetHandle`, `SheetHeader` | Grabber + title row for `@gorhom/bottom-sheet` |
| `RecordStrip` | The signature visual (below) |
| `Skeleton` | Card-, row- and strip-shaped placeholders with a slow opacity pulse |
| `OnboardingFrame`, `ProgressBar`, `Celebration` | Duolingo flow chrome |

## 5. The record strip

Every state visit in the last 24 months is a column at its date. A visit with findings is a stack of rounded marks, one per finding, highest-risk rule at the bottom. **Solid** = corrected at the inspection or verified fixed by the state. **Outlined** = not yet verified. A dot on the baseline = a visit with no findings posted. Variants: `hero` (place page, onboarding), `full` (findings tab, with axis + key), `compact` (cards, rows, alerts). It shows counts and dates only; there is no total, no color for "good", and no label that ranks.

## 6. Screens

| # | Screen | Structure |
|---|---|---|
| 1 | Home | Map full-bleed. Search pill top (safe area + 8). Locate `FloatButton` rides above the sheet. Sheet detents peek / half / full. Peek: "**N daycares** near you" `largeTitle` + chip row (Centers · Homes · In TX-04 · Accepts subsidies). Half (60%): carousel of `DaycareCard`. Full: `PlaceRow` list. |
| 2 | Place page | `MapSnapshot` hero 240 high bleeding under the status bar; sheet-style body with 28 top radius overlapping the hero by 28. Name `display`; meta line; `InfoChip` row (ages · capacity · hours · subsidies); action row (Call · Directions · Official record · Share); sticky bottom bar with `Button ink` "Watch this daycare" + square share button (uber-3); `Tabs` Overview / Findings / Rights. Overview, three different shapes so it never reads as a card grid: `RecordStrip hero` → `StatBand` (visits · findings · on High risk rules) → `RingCard` (verified fixed, N of M) → "Next to the county" as two bars (this daycare in ink, county median in grey) → "Last checked with the state". |
| 3 | Onboarding | `ProgressBar` + close. Step 1 why (real TX-04 numbers as numerals). Step 2 find your daycare (search). Step 3 alerts (explain, then OS prompt). Celebration on watch. |
| 4 | Alert | Compact strip with the new mark pulsing once, "What the state posted", plain words, date, what you can do (rights cards). |
| 5 | Findings + Rights | Findings: timeline cards grouped by visit. Rights: action cards that open the generated request. |

## 7. Rules

- Never a grade, score, star, rank, or traffic-light color. No green anywhere in the record.
- Copy is calm. Use "finding", "not yet verified", "corrected during the inspection". Never "violation alert", "warning", "danger".
- Every data screen carries "Last checked with the state <time>".
- AA contrast in light and dark; tap targets ≥ 44; Dynamic Type to AX-XXXL without clipping (numerals cap at 1.3×, axis labels at 1.35×).
- Blur only over the map. No gradients. No illustrations. No stock imagery. The only imagery is real maps of real locations.

## 8. Not us (the generated-UI tells, and what we do instead)

Sources: Fountain Institute, "7 Signs a UI Has Been Vibe Coded"; Tessl `de-llm-ui` review skill; robotsonpayroll, "How to avoid that vibe-coded look"; Draftbit `mobile-taste-skill` (React Native tells); NN/g, "GenUI vs vibe". `harness/bin/slopcheck.py` fails the build on the mechanical ones.

| Tell | Why it reads as generated | Us |
|---|---|---|
| Indigo / purple / "internet blue" accent, purple-blue gradients | Tailwind's default `indigo-500` is in every training example | Ink for every action, school-bus yellow for one meaning (watching). No gradients anywhere |
| Neon-on-dark, aurora glows | Over-represented "modern SaaS" look | True black dark mode, one yellow, no glow |
| Inter everywhere | The default web font of every template | The platform grotesk (SF Pro / Roboto), heavy and tightly tracked like the system apps |
| Soft grey shadow on every floating card | Default `shadow-md` | Flat surfaces. Only map chrome (search pill, locate, pins) floats. 3D pieces use a solid bottom edge, not a blur |
| Every section in a rounded rectangle; stacks of white cards | Layout by container, not by hierarchy | Open sections separated by space and hairlines; cards only where a card is a thing you tap |
| Grid of identical stat cards | The "dashboard" stock pattern | Stat band + one ring card + bars: each number gets the shape that fits it |
| Colored left-border cards | Default "callout" component | Pills and plain labels (slopcheck blocks `borderLeftWidth`) |
| Emoji or stock icon sets (Lucide, Feather, Ionicons, MaterialIcons) | Zero-effort iconography | SF Symbols on iOS, Material Symbols on Android via `expo-symbols`; pins and record marks drawn by us |
| Pastel overload, clip-art illustration | Filler color and filler art | Color comes from the map photo and the ember record. No illustration |
| Generic copy ("Welcome back!", "Unlock insights"), explainer paragraphs | Text pasted from the prompt | DoorDash-length labels; numbers carry the message |
| Generic empty / error states | Only the happy path was designed | Skeletons shaped like the real card; empty states say what's true ("No findings posted in 24 months") and give one action |
| Five-tab bar with a floating + button | The template app shell | Three tabs (Find · Watching · Your rights), map first |

What "built" looks like here: a 4/8-pt rhythm, optically centred glyphs, card shapes that vary with content, hierarchy through size and weight before color, haptics on every commit, springs on the sheet and presses, skeletons on every load, and corner radii that grow with elevation (chip 999 · thumb 12 · card 16 · stat 22 · sheet 28).
