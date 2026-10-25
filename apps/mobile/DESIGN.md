# Daycare Watch — design system v4 (frozen)

**One line:** a map app, not a document. Grouped grey surfaces carry white cards, the map and the 3D views supply the color, the type is the native grotesk set heavy and big, and every daycare page answers one question in one sentence before anything else: *what did the state find last time?*

v4 is frozen for the Oct 26 2026 submission. Changes after the freeze go into §12 with a date and a reason.

---

## 1. Reference board (structure we copy, not branding)

| App | Pattern we take | Measurements we use |
|---|---|---|
| **Google Maps** | Full-bleed map, floating search pill, filter chip row, place sheet: hero, huge name, info chips, action row, tabs | Search pill 52 high, full radius, 16 side inset. Chips 36 high, 14 horizontal padding, 8 gap, scroll with no indicator. Action tiles equal width, icon + label |
| **Uber** | Black/white confidence, one signal color, bold headers, sticky bottom action bar, a map with a sheet | Headline 28 / 800, tracking −0.6. Bottom bar: 56 button + 16 padding + safe area, hairline top |
| **DoorDash** | Store card: big picture on top, bold name, one meta row; horizontal carousels; dense clean list | Carousel card 0.76 × screen width, picture 2:1 (1.2:1 in onboarding), radius 16, name 17/700 two lines max, 12 gap, next card peeks. List row: 64 thumb radius 12 |
| **Apple Maps** | Sheet detents, blur only over the map, place card layout, the 3D flyover | Detents: peek 156 + bottom inset, half 60%, full = screen − top inset − 8. Grabber 36×5. Sheet top radius 28. Flyover pitch 56, altitude 340 m |
| **Duolingo** | Onboarding: progress bar on top, one decision per screen, chunky 3D buttons, a finish moment | Progress bar 14 high, radius 7. Button 56 high, radius 16, 4 pt bottom edge one shade darker |
| **Cal AI** | Huge confident numerals | Numeral 56/800 tabular, tracking −1.5 |
| **Brilliant / Headspace / Calm** | Crisp geometric marks, soft color fields, motion with a purpose | Soft field = a category tint behind its glyph. Nothing loops except the flyover drift |
| **Apple Settings / Health** | Grouped grey background with white rounded cards | bg #F2F2F5, card radius 20, 16 padding, 12 between cards |

**Copy rule from the refs:** a card is a name, one meta line and one picture. No explainer paragraphs, no badges, no filler. Details sit one tap deeper.

## 2. Decisions (locked)

| Axis | Decision | Why |
|---|---|---|
| Aesthetic | **Map-native utility**: Uber contrast, Google Maps structure, Settings-style grouped surfaces | The data is serious; the app should feel as sure-footed as the apps parents already use every day |
| Type | **SF Pro (iOS) / Roboto (Android)** via `Platform.select`. Titles 700–800, tight tracking. Every number tabular. No serif, no display font | The native face reads "real app" instantly; weight and size carry the character |
| Surfaces | Light: grouped grey `#F2F2F5` with white cards. Dark: true black with graphite `#1C1C1E` cards | Flat white pages read as a document; grouped cards give every block an edge |
| Action color | **Every action is ink** (black in light, near-white in dark) | Uber confidence; one strong action per screen |
| Signal color | **School-bus yellow `#FFC800`** (dark `#FFD21F`), used only for *watching* and *alerts* | Every parent already reads it as "kids on the move", it can't be mistaken for a rating, and it is never on a daycare's record. A fill only, always with ink on top |
| Category hues | Nine categorical tints, one per kind of rule (§4) | They answer "what kind of problem", never "how bad". Hue order carries no meaning |
| Record | Words and counts, no colored rating. A single ink "Serious" tag for findings under a rule the state rates High risk | One tag, earned by the state's own label |
| Imagery | Real places only: Apple 3D flyover and aerial tiles, each with our pin. No stock art, no illustration | We have no photos of our own; the location *is* the picture |
| Depth | Three levels: card (soft), float (map chrome, pins), sheet | Shadows say "this floats"; 3D buttons use a solid edge, not a blur |
| Motion | 150–250 ms, ease-out, no bounce, no overshoot (§6) | Motion explains where things came from; it never decorates |

## 3. Tokens (`src/theme/tokens.ts`)

### Type (system face; iOS switches Text/Display optically at 20 pt)
| Token | Size / line | Weight | Tracking | Max Dynamic Type | Use |
|---|---|---|---|---|---|
| `numeral` | 56 / 60 | 800 | −1.5 | 1.3× | Hero counts |
| `display` | 34 / 38 | 800 | −0.8 | 1.4× | Onboarding headlines |
| `largeTitle` | 28 / 32 | 800 | −0.6 | 1.5× | The answer on Place, screen titles |
| `title` | 22 / 27 | 700 | −0.4 | 1.7× | Daycare name, section heads |
| `headline` | 17 / 22 | 700 | −0.2 | 2× | Card names, buttons |
| `body` | 17 / 24 | 400 | −0.2 | 2.2× | Plain-English summaries |
| `subhead` | 15 / 20 | 600 | −0.1 | 2× | A finding in plain words, small weighted labels |
| `callout` | 15 / 20 | 500 | −0.1 | 2× | Meta rows, chip labels, fix status |
| `footnote` | 13 / 18 | 500 | 0 | 2× | Dates, sources, "Last checked" |
| `caption` | 12 / 16 | 600 | 0 | 1.8× | Map credit, pin labels |

Android uses the same sizes on system Roboto with numeric weights (a loaded Roboto Flex maps weights unreliably in React Native). **Rule:** at most 3 type sizes in any first view.

### Color
| Token | Light | Dark | Notes |
|---|---|---|---|
| `bg` (grouped background) | `#F2F2F5` | `#000000` | |
| `surface` (cards, sheet) | `#FFFFFF` | `#1C1C1E` | |
| `sunken` (inside a card: chips, bars, fields) | `#E8E8ED` | `#2C2C2E` | |
| `hairline` | `#E8E8EC` | `#26262A` | |
| `skeleton` | `#E4E4E9` | `#1F1F22` | |
| `text` | `#0B0B0C` | `#F5F5F7` | 17.6:1+ |
| `textSecondary` | `#5C5C66` | `#A8A8B2` | 5.9:1+ on sunken |
| `textTertiary` | `#6E6E78` | `#8C8C96` | 4.5:1 floor (AA) |
| `accent` (links, plain buttons, progress, selected marks) | `#0B0B0C` | `#F5F5F7` | ink in both modes; yellow never marks an action |
| `accentSoft` (selected wash, halo) | `#FFF6C9` | `#2A2300` | |
| `signal` (watched pin, alerts button, check badge) | `#FFC800` | `#FFD21F` | ink on it 12.7 / 14.5 |
| `signalEdge` (3D edge) | `#D19E00` | `#A88200` | |
| `ink` (black button, selected chip, cluster) | `#0B0B0C` | `#F5F5F7` | |

### Space, radius, elevation
| | Values |
|---|---|
| Space (4-pt) | 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 |
| Radius | sm 8 · thumb 12 · button 16 · card 16 · place card 20 · stat 22 · banner 24 · sheet 28 · pill 999 |
| Elevation | `card` y4 blur 12 @ 7% · `float` y4 blur 16 @ 14% (search pill, locate, banner) · `sheet` y−4 blur 24 @ 10% · pins y2 blur 5 @ 28% |
| Haptics | `select` chips, tabs, picking a card · `press` 3D buttons, banner arrival · `heavy` watch toggle · `success` watching confirmed |

## 4. Category icons (`CategoryIcon.tsx`, `Glyph.tsx`)

Every finding belongs to one of nine kinds of rule. Each kind gets one SF Symbol (Material Symbol on Android) in a tinted disc. The tint says *which kind*, never *how bad*: a supervision finding and a paperwork finding at the same risk level look equally calm.

| Key | Label | Glyph (iOS) | Light fg / bg | Dark fg / bg | Meaning shown in "What the categories mean" |
|---|---|---|---|---|---|
| `supervision` | Supervision | `eye.fill` | `#0B62E0` / `#E4EEFF` | `#6EA8FF` / `#132845` | Watching the children: who was where, and whether an adult could see them. |
| `staff_ratio` | Staff ratio | `person.3.fill` | `#007C8A` / `#DCF3F5` | `#4FD1DC` / `#0C3034` | How many adults there were for the number of children in a room. |
| `background_checks` | Background checks | `person.text.rectangle.fill` | `#4744C4` / `#E9E9FB` | `#A3A1FF` / `#222147` | Whether staff had the state's required background checks on file. |
| `safety_hazards` | Safety hazards | `exclamationmark.triangle.fill` | `#B85600` / `#FFEEDB` | `#FFAA5C` / `#402810` | Things in the building or yard that could hurt a child. |
| `health_medication` | Health & medication | `cross.case.fill` | `#BF1F63` / `#FCE5EE` | `#FF7EAE` / `#401627` | Medicine, allergies, sickness, cleaning and food handling. |
| `discipline` | Discipline | `hand.raised.fill` | `#8439BF` / `#F2E7FB` | `#CE8FFF` / `#311B47` | How staff corrected children's behavior. |
| `parent_communication` | Telling parents | `bubble.left.and.bubble.right.fill` | `#0A76A6` / `#DFF1FA` | `#5CC4F2` / `#0F2E3D` | What the daycare must tell parents, and when. |
| `paperwork_admin` | Paperwork | `doc.text.fill` | `#765737` / `#F1E9E0` | `#D6B892` / `#33281B` | Forms and records the state requires. |
| `other` | Other | `ellipsis` | `#5C5C66` / `#EBEBEF` | `#AEAEB8` / `#333338` | Rules that don't fit the groups above. |

| Primitive | Spec |
|---|---|
| `CategoryIcon` | Disc `size` (default 36), glyph 0.5 × size in `fg` on `bg`. 32 on FindingCard, 36 in Place top problems, 40 in onboarding |
| `CategoryRow` | Up to 4 overlapping 24 discs (18% overlap, 2 pt surface ring) + "+N" in `footnote`. On "In TX-04 last week" feed rows (`district_recent_visits.categories`): what kinds of problems that visit found |

No green and no red in the set; the safety-hazards orange and health pink sit at the same lightness as the blues, so neither reads as an alarm.

## 5. Primitives (`src/components/ui/`)

| Component | What it is |
|---|---|
| `Text` | The one text primitive; variants in §3; per-variant max scale; `tabular` default on numerals |
| `Button` | Duolingo 3D: face + 4 pt edge, 56 high, radius 16. Kinds: `ink` (the main action everywhere), `primary` (yellow: "Turn on alerts" and "Watching · alerts on" only), `secondary` (white + grey edge), `onImage` (white face, `#BDBDC4` edge, ink text, over photos and the flyover), `plain` |
| `Chip` / `InfoChip` | Filter chip (selected = ink fill) · info chip (glyph + label on `surface`) |
| `SearchPill` / `FloatButton` | Map chrome, `float` elevation |
| `ActionTile` | Equal-width tile, glyph over label, `surface` + `card` elevation |
| `DaycareCard` | DoorDash card: picture on top (`heroRatio`, default 2:1), name 17/700 two lines (min height 44 so a carousel row stays even), one meta line, one record line in words ("1 problem found Oct 5") |
| `PlaceRow` | Dense row: 64 thumb, name two lines, meta, record line |
| `MapSnapshot` | Aerial tile mosaic (Esri World Imagery) with our pin; credit on every image; tiles load on view only. Homes get a street canvas with an area circle (§8) |
| `FlyoverHero` | Apple Maps `satelliteFlyover` camera: pitch 56, altitude 340 m, start heading 20°, drifts 24° every 9 s. iOS + exact address only; a still `MapSnapshot` on Android and web. Reduce Motion keeps the 3D view and stops the drift, so the "3D view · Apple Maps" caption is always true. `legalTop` moves the Apple legal mark clear of text |
| `PlaceGallery` | The Place hero carousel (§9) |
| `MapPin` / `AreaPin` / `ClusterBubble` | §7 |
| `FindingCard` | White card, `card` elevation. Header: `CategoryIcon` 32 + category in grey. Then the finding in plain words (`subhead`), the fix status with a check or clock glyph, and one line with the state's own label: High = "Serious · High risk rule, per the state" in `subhead` plus a 1.5 pt ink border; every other level = "<level> risk rule, per the state" in tertiary. Then the inspector's own words and "View on the state's site" |
| `SeriousTag` | The only tag on Place: a small ink pill, on High-risk findings only |
| `status.ts` | Fix-status copy, pure and tested (§10) |
| `AlertBanner` | An iOS notification banner with our real push copy; the tag sits where iOS shows "now" ("Example", "Replay") |
| `RightCard` | One right, one tap: glyph disc, bold title, one-line detail, opens the generated request |
| `Tabs` | Place tabs, underline slides between tabs (200 ms) |
| `Skeleton` | Card-, row- and hero-shaped placeholders (`heroRatio`), slow opacity pulse, cross-fade to content |
| `OnboardingFrame` / `ProgressBar` / `OnboardingTop` / `Celebration` | Onboarding chrome (§11) |
| `AppMark` | The mark: one visit on a time rail (ink ring, solid centre, an earlier visit to its left). Reads as a visit and as an eye. Never a letter in a square |
| `RecordStrip` | Kept as the data helpers `stripFromRecord` / `stripFromRow`; the drawn strip is off Place and cards (it needed a legend) |

## 6. Motion (tokens: `motion`, `spring`, `theme/motion.ts`)

**Rule:** minimal and calm. 150–250 ms, ease-out in, ease-in out, **no bounce, no overshoot, no confetti, no bursts, nothing that pulses for attention.** Every animation respects Reduce Motion (`ReduceMotion.System`).

| Token | Value | Use |
|---|---|---|
| `motion.fast` | 150 ms | Press feedback, pin name pill, chip toggle |
| `motion.base` | 200 ms | Content enter, cross-fades, tab underline, Watch confirm |
| `motion.slow` | 250 ms | Progress bar, alert banner arrival, onboarding layers |
| `motion.stagger` / `maxStagger` | 30 ms / 3 items | List stagger, **first load only** |
| `motion.rise` | 8 pt | Enter = fade + 8 pt rise |
| `motion.pressScale` / `pressOpacity` | 0.98 / 0.9 | Every pressable card, tile and button face |
| `easeOut` / `easeIn` | cubic | All timings |
| `spring.sheet` | damping 30, stiffness 260, overshoot clamped | Sheet detents |
| `spring.press` / `spring.pop` | damping 28–30, overshoot clamped | 3D button edge, selected pin |

| Moment | Motion |
|---|---|
| Sheet / map | Sheet springs between detents with no overshoot; camera flies to the user's area (animateCamera, 600 ms system curve) |
| Carousel | Native paging; page dots follow the scroll position |
| Onboarding steps | Progress bar slides 250 ms; each step's content enters with `enter(i)`; how-it-works layers rise 16 pt over 250 ms |
| Alert banner | Slides 32 pt from above over 250 ms with opacity, light haptic at 200 ms |
| Watch confirm | Button label cross-fades (opacity 0.5 → 1, 200 ms), heavy haptic; no scale |
| Watching confirmed | Yellow badge fades in 200 ms, then the check draws once left to right (350 ms) with a success haptic. Static soft halo |
| Skeleton → content | 200 ms cross-fade |
| Flyover | Camera drifts 24° every 9 s while the screen is visible; under Reduce Motion the 3D view holds still |

## 7. Pins (`MapPin.tsx`)

| Pin | When | Look |
|---|---|---|
| `MapPin` | A Licensed Center whose address geocoded exactly | White 30 disc, ink type glyph 14 (`center` building, `schoolAge` backpack), pin shadow. Selected: 44 disc, 3 pt ink ring, glyph 20, name in an ink pill below (fades in 150 ms). Watched: yellow disc with an ink bell |
| `AreaPin` | Any approximate location, and **every home daycare, always** | Translucent ink area (52, selected 72) with a 1.5 pt edge and a small white core carrying the type glyph. Watched = yellow area. Never a point on a family's house |
| `ClusterBubble` | Nearby daycares grouped | Ink circle 38 / 44 / 52 with a 3 pt white ring and a heavy tabular count ("1.2k" past 999) |

Every daycare gets the same white pin, so the map never ranks anyone. Pin color never encodes the record. **Layering:** areas 0 · pins 1 · watched 2 · clusters 3 · selected 10, so an area never covers a pin.

## 8. Location imagery

| Daycare | Hero | Cards / thumbs | Caption |
|---|---|---|---|
| Licensed Center, exact address | `PlaceGallery` carousel (§9) | Aerial with pin | "Location from the state record" / "Placed from the street address" |
| Licensed Center, approximate address | Plain muted map with an area, no aerial, no flyover | Aerial | "Approximate location (address matched with corrections)" |
| Any home type, or unknown type | Grey street canvas, zoom ≤ 14, ~400 m area circle on a 0.005° grid point, **no pin, no photo, no flyover**. City + ZIP only | Same canvas | "Neighborhood only · private home" |

`lib/imagery.ts` (`imageryAllowed`) is the single test, and `FlyoverHero.flyoverAllowed` adds the exact-address check. Credit shows on every image ("Imagery © Esri, Maxar", "Map © Esri, HERE, Garmin, OSM", "© Esri" on thumbs, Apple's legal mark on the 3D view). An aerial never claims to show the building.

## 9. Place hero carousel (`PlaceGallery`)

```
┌────────────────────────────────────────┐
│ [‹]                            [share] │  floating round buttons, float elevation
│                                        │
│        3D view with our pin            │  hero 0.62 × width, full bleed
│                                        │
│ 3D view · Apple Maps            ━ ○ ○  │  caption left · page dots right
└────────────────────────────────────────┘
```

| Rule | Spec |
|---|---|
| Order | 3D flyover with our pin (aerial with pin where the flyover isn't allowed) → aerial (z17) with pin → a Street View tile that opens Google Street View at the address |
| Pin | Every picture page carries our pin at the point, so page 1 is unmistakably this place (`FlyoverHero` draws it on the 3D view) |
| Dots | 6 pt dots, 6 gap, on a 30% black pill; the current dot is a 16 × 6 capsule that stretches with the finger |
| Caption | Flyover: "3D view · Apple Maps". Aerial: the §8 caption |
| Credit | Aerial: "Imagery © Esri, Maxar". Apple's legal mark stays visible, moved clear of text with `legalTop` |
| Scrim | Bottom 35% stepped black scrim (0 → 45%) so white text clears 4.5:1; top 64 pt at 22% so the status bar reads |
| Street View | The last page is a tile that opens Google Street View at the address; we host no street image |
| One page | No dots |
| Homes | Never a carousel: the §8 canvas, no dots, no pin |
| Card thumbnail | The aerial with our pin |

**No street photos in the submission.** Mapillary street photos were wired and tested, but in a hand check 2 of 5 showed the wrong building or a reflection, and a picture that might be the wrong place breaks the app's one promise. They stay off until each photo can be matched to the building.

## 10. The record, in words

The record is **one answer and a list of rows**, like Apple Weather's 10-day forecast. Nothing on Place needs a legend.

```
3 problems found at the Oct 5 visit        largeTitle 28, the answer
Fixes due Oct 30 · no state check on record yet   callout 15, grey (last three words never split)
(◉) <the problem, in plain words>  Serious  top 2 problems: CategoryIcon 36, tag on High only
 See all 9 from the past 2 years        >
Past 2 years
 Oct 5                    Fix due Oct 30   two-line rows
 3  ███████████
 Dec 5, 2025      Fixed · state checked
 4  ██████████████
```

| Rule | Why |
|---|---|
| One question per screen. Place answers "what did the state find last time?" | A parent decides in 5 seconds |
| First view = one answer, at most 3 key facts, one primary action | Density on demand, one tap deeper |
| 6th-grade words: "problems", "Fix due Oct 30" | No "violation", "deficiency", "warning", "danger" |
| Empty: "No problems cited" (a visit) · "No problems posted in 2 years" (a record) | Never "nothing found", which reads as "safe" |
| Bar length = count at that visit, ink on sunken | Counts only. No color for good or bad |
| Every data screen carries "Last checked with the state <time>" | Freshness is part of honesty |

**Fix-status short forms** (`status.ts`, tested; never a bare "Fixed"):

| State record says | Row / chip | Detail line |
|---|---|---|
| Corrected at the inspection | Fixed during the visit | Fixed during the visit |
| Corrected, state verified | Fixed · state checked | Fixed · the state checked <date> |
| Fix date in the future | Fix due <date> | Fix due <date> · no state check on record yet |
| Fix date passed, no verification | Fix date was <date> | Fix date was <date> · no state check on record yet |
| No date | No fix date | No fix date on record |

## 11. Screens

| # | Screen | Structure |
|---|---|---|
| 1 | **Home** | Map full-bleed with `MapPin` / `AreaPin` / clusters. Search pill top (safe area + 8). Locate rides above the sheet. Sheet peek: "Daycares near you" ("Daycares near Frisco" when the list is around a town, not the parent) + chip row. Half: "Closest to you" carousel ("Closest first" around a town) of `DaycareCard`, then the "In TX-04 last week" feed, then "All nearby". Full: `PlaceRow` list. "What the categories mean" (a quiet link at the end of Place's Problems tab) opens a form sheet with `CategoryGuide`: the nine discs, labels and plain meanings, never a legend on the record itself |
| 2 | **Place** | `PlaceGallery` hero → head on `bg`: name `title`, address · TX‑04 → white card: the answer + top 2 problems + "See all" → info chips → action tiles (State record · Directions; homes: State record only) → tabs Overview / Problems N / Your rights. Overview: white card "Past 2 years" rows → "Ask about these on your tour" → "More details". Sticky ink "Watch this daycare" + share; when alerts are off it reads "Watching · alerts off" (secondary, outline bell) |
| 3 | **Onboarding** | Five steps, progress bar + Skip on each (below) |
| 4 | **Alert** | The push opens the visit: same answer as Place for the new visit, the findings posted so far as `FindingCard`s, what changed since the last visit, what you can do (rights cards) |
| 5 | **Problems + Rights** | Problems: visits newest first, highest state risk first; 2+ Low / Medium Low fold into "N less serious problems". Rights: one `RightCard` per right, each opens the generated request |

**"In TX-04 last week" feed** (on Home, under the closest cards; data `district_recent_visits`): header "In TX-04 last week" + one grey line with the date range, the visit count and how many have findings posted so far. Rows on the 16 gutter with hairlines: a 36 lead (`CategoryRow` when findings are posted, else the type glyph on `sunken`), name, "City · Visited Oct 16", and "N findings posted so far" or "No problems posted so far". Items are **newest first, always**: never sorted by findings, which would read as a ranking. Centers by name; **home daycares never named** ("A licensed home in <city>"). The standalone "This week" tab is parked.

**Onboarding** (`src/app/onboarding/`):

| Step | File | What the parent sees |
|---|---|---|
| 1 | `index.tsx` | Full-bleed 3D flyover of a real licensed center, stepped scrims, the white mark and "Know what Texas inspectors found before you pick a daycare." Caption names the place and "3D view, Apple Maps". `onImage` "Get started" |
| 2 | `how.tsx` | Three beats on one stage, advanced by Next or a tap: the raw state record → the same finding in plain words (CategoryIcon, Serious tag, fix status) → the alert banner tagged "Example" with our real push copy. Earlier layers sit under a 55% wash |
| 3 | `find.tsx` | Search pill, "Centers near Frisco" + "Use my location", a carousel of real licensed centers (cards 1.2:1). Picking lifts the card 2 pt with a yellow check and a select haptic |
| 4 | `alerts.tsx` | "Turn on alerts." + "Only for daycares you watch, and only when the state posts something new." A lock-screen panel (flyover wallpaper, live time) with the banner arriving. Then the OS prompt on "Turn on alerts"; "Not now" always works |
| 5 | `done.tsx` | The check draws once: "You're watching <name>." and one line on what happens next |

## 12. Rules and anti-patterns

- Never a grade, score, star, rank, or traffic-light color. No green anywhere on a record.
- Calm copy: "problems", "Serious" only for the state's High risk label, "a finding under a rule the state rates High risk". Never "violation alert", "warning", "danger", "nothing found".
- AA contrast in light and dark; tap targets ≥ 44; Dynamic Type to AX-XXXL without clipping (illustrations inside mock screens cap at 1.3×).
- Blur only over the map. No gradients. No illustration. No stock imagery. Only real places.
- A lint script fails the build on `borderLeftWidth` callout cards and banned icon sets.

| Tell of template UI | Us |
|---|---|
| Indigo / purple / "internet blue" accent, gradients | Ink for every action, yellow for one meaning. No gradients |
| Neon on dark, glows | True black, graphite cards, one yellow |
| Inter everywhere | The platform grotesk, heavy and tightly tracked |
| Grid of identical stat cards | One sentence that answers, then rows |
| Colored left-border callouts | Pills, plain labels, category discs |
| Stock icon sets, emoji | SF Symbols / Material Symbols via `expo-symbols`; pins and the mark drawn by us |
| Clip-art illustration | Real places: 3D flyover and aerial, with our pin |
| Generic copy ("Welcome back!", "Unlock insights") | DoorDash-length labels; numbers carry the message |
| Generic empty / error states | Skeletons shaped like the real card; empty states say what's true and give one action |
| Confetti, bouncing, pulsing | §6: 150–250 ms, no overshoot |

**5-second test (on every screen):** Viva World School → "3 problems at the Oct 5 visit, fixes due Oct 30, one serious (pool gate)."

### Change log after the freeze
| Date | Change | Why |
|---|---|---|
| Oct 25 04:16 | Dark `accent` = near-white ink, not yellow | Plain buttons and the progress bar were yellow in dark, breaking "yellow = watching" |
| Oct 25 03:04 | Reduce Motion keeps the 3D view, without drift | A swapped-in aerial ran under an Apple caption with no Esri credit |
| Oct 25 02:36 | Street photos off; carousel = 3D → aerial → Street View link | 2 of 5 hand-checked photos showed the wrong building |
| Oct 25 02:33 | Our pin on the 3D view | A whole block from above can't say which building is the daycare |
| Oct 25 02:25 | Carousel page 1 = 3D view, photos second | Street photos are dashcam frames near the address; the flyover is the strongest real picture |
| Oct 25 02:24 | Answer line keeps "on record" ("no state check on record yet"), tail held with non-breaking spaces | The state may have checked without posting it; the tail wraps as one unit |
| Oct 25 02:12 | Serious tag rides the meta line in top problems | The tag column squeezed the finding text at large sizes |
