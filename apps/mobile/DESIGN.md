# Daycare Watch: design

**Direction: a public record, calmly told.** The app reads like a well-set government document that someone took the trouble to explain: warm paper, dark ink, one quiet accent, every fact dated and sourced. It never looks like a dashboard, and it never grades anything.

## 0. Audit, Sat Oct 24 9 pm (design terminal)

**Verdict:** this build is honest and calm, but a judge would still call it a template. Every screen is the same three things: an uppercase tracked label, Public Sans text, and a hairline. Nothing on any screen shows the record. A parent has to read every line to learn what one picture could tell them in two seconds.

| Screen | What reads as machine-made | Why it matters |
|---|---|---|
| All | Every section opens with the same small-caps tracked eyebrow (LAST 24 MONTHS, IN CONTEXT, WHAT INSPECTORS FOUND, SEND A REQUEST) | This is the most common generated-UI tic. It gives every section the same weight, so nothing reads as the lead |
| All | One family at one voice. The daycare's name, the counts, and the inspector's words all look the same | A record has three voices (who, what the numbers are, what the state wrote) and the type should separate them |
| Record, top | The top third is a name, a button, and four lines of numbers. No picture of the history | A parent at 7 am needs the shape of the record (how often visited, when findings clustered, what is still open) before any number |
| Record, top | The Watch button is a full-width outlined box, the default component-library look | It's the main action and it looks like a form field |
| Record, context | The four-row comparison table is a spreadsheet, with 4 vs 5 and 9 vs 2 set as equal-weight cells | The one comparison that matters (findings vs the county median) is buried in row 3 |
| Record, timeline | Each finding is the same block: marks, label, sentence, gray line, "Inspector's words ⌄". Three identical blocks per visit | The repeated disclosure link is visual noise, and "Cited Oct 5, 2026" repeats the visit date already in the header |
| Record, timeline | Fix-status line wraps a single word ("state") onto its own line | Looks unedited |
| Find | Stock map tiles with identical black dots. The dots carry no information | The map is the first thing a parent sees and it says nothing about any daycare |
| Find, list | Every row is three lines of gray text at the same weight | You can't tell a daycare with 16 findings from one with 1 without reading |
| Alert | The replay notice is a generic bordered box, and "What it means" is a 6-line paragraph | The notice should read like a stamp on a document, and the explainer should be 2 lines plus "more" |
| Rights | The iOS grouped-list card, then a stack of identical heading + paragraph + "The law's words ⌄" | It's the default settings-screen look, used for the app's most consequential feature |
| Watching | One row, then 1,200 pt of empty screen | It doesn't show what changed or when the state last posted anything |
| Onboarding | None. The app opens cold onto a map | Nobody is told why this exists, which is the whole pitch |

**The fixes, as a system:** (1) a signature *record strip* that draws each state visit as a mark, used on the record page, list rows, the map callout, watching, and onboarding. (2) Newsreader serif for names, titles, and the inspector's quoted words; Public Sans with tabular figures for every number. (3) Sentence-case serif section heads over a full-width ink rule, like a printed report, replacing every uppercase eyebrow. (4) Inspector's words shown inline as a two-line serif italic quote that expands, instead of a repeated link.

## 1. What the research showed

| Source | What we take | What we avoid |
|---|---|---|
| Texas Child Care Search (what we replace) | Its fields: date, standard, risk level, correction date, narrative. HHS's own wording: "a requirement weighted as high presents a greater risk to children if violated." | The findings are at the bottom of the page, every narrative hides behind its own popup, and nothing answers the questions HHS tells parents to ask |
| Carfax report | The summary at the top is only counts and dates. Each fact names its source. A dated "as of" line. Events numbered by date, one fact per row. | Brand color shouting at you |
| UK food hygiene ratings | Each level is a phrase and not only a number. The inspection date is always shown. | The rating itself, because we never grade |
| NYC grades, mirror sites | Findings grouped by visit date, with counts per visit | The letter placard |
| Life360 | Alert = subject + verb + place, no adjectives | |
| Apple Health | What was found, how it was confirmed, then one next step | |
| Citizen | Its resolution follow-up ("no longer requesting assistance") | "NEARBY!", alarm sounds, fear as a growth loop |
| Brightwheel reviews | Parents want the fact without opening the app, so the push body carries it | One endless feed |
| Tadpoles | Keeps the factual log separate from everything else | |

## 2. Principles

1. **Every fact is dated and sourced.** "The state posted…", "Cited Mar 4, 2026 · Fix due Mar 12 · not yet verified by the state", "Last checked with the state today at 9:14 AM". If we didn't get it from Texas HHS, it isn't on screen.
2. **Words first, color second.** Seriousness uses the state's own words ("High risk") plus a five-mark glyph that shows rank by how many marks are filled. Color backs up both, and nothing is ever conveyed by color alone.
3. **Counts, not verdicts.** The summary shows numbers and dates. We never say safe, unsafe, good, bad, a score, or a rank. There is no green, so the app never implies "all clear".
4. **Plain words first, the inspector's words one tap away.** Each finding gives a one-sentence plain summary, and the state's narrative opens in place, word for word. No popups.
5. **Say what's missing.** "No findings posted from this visit." "Findings from this visit aren't posted yet." "The state gives no fix date." Absence is information.
6. **Answer the questions HHS tells parents to ask.** Was it fixed, when, and did the state verify it? Did the same rule come up again? How does this compare with similar daycares in the county?
7. **Calm alerts.** One fact per alert, in sentence case, with the default sound. The title is the daycare and the body is what the state posted.
8. **Built for 7 am.** The answer is in the top third of the screen. 44 pt targets, Dynamic Type up to the largest accessibility size, and screen readers hear full sentences ("High risk rule. Supervision. Cited March 4, 2026. State verified the fix March 12.").

## 3. Daycare record page, top to bottom

```
┌──────────────────────────────────────────┐
│ Ivy Kids of Coit                 (title) │  name, then type · city
│ Licensed child care center · McKinney    │
│ [ Watch this daycare ]  (one accent btn) │
├──────────────────────────────────────────┤
│ LAST 24 MONTHS                           │  summary = counts + dates only
│ 9 visits · 4 with findings · 11 findings │
│ 3 High risk · 2 not marked fixed         │
│ Last visit Oct 22, 2026                  │
├──────────────────────────────────────────┤
│ Compared with 212 licensed centers in    │  area comparison (medians, SQL)
│ Collin County: findings 11 vs median 4   │
├──────────────────────────────────────────┤
│ WHAT INSPECTORS FOUND                    │  timeline grouped by visit
│ Oct 22, 2026 · Inspection                │
│   No findings posted from this visit     │
│ Feb 1, 2022 · Investigation · 2 findings │
│   ▮▮▮▮▮ High risk · Discipline           │
│   A caregiver pulled a child's arm…      │  plain summary
│   Cited Feb 1, 2022 · State verified fix │
│   ▸ Inspector's words                    │  expands in place
├──────────────────────────────────────────┤
│ Facts: ages · capacity · hours · subsidy │
│ Ask on a tour  →   Your rights  →        │
│ Official state record ↗                  │
│ Last checked with the state today 9:14 AM│
└──────────────────────────────────────────┘
```

## 4. Alert copy pattern (agreed with pipeline, Oct 24)

| Kind | Title | Body |
|---|---|---|
| new_violation | Daycare name | The state posted 2 new findings from a visit on Oct 3. Tap to read what inspectors wrote. |
| status_change | Daycare name | The state now lists this daycare's permit as inactive. / …as active again. |
| corrective / adverse action | Daycare name | The state placed this daycare under corrective action. / …lists corrective action at this daycare as ended. |
| closure | Daycare name | The state lists this daycare as temporarily closed. |
| capacity_change | Daycare name | The state changed licensed capacity from 120 to 90. |
| replay | same | Prefixed "Replay of a real state record from Oct 3, 2026: " |

The alert detail screen follows the Apple Health shape: **what the state posted → when → what it means → what you can do** (rights request, tour questions, report a concern).

## 5. Design system (`src/theme/`, `src/components/ui/`)

| Token | Choice | Why |
|---|---|---|
| Type: names + titles | **Newsreader** 500/600 (Production Type): `serifType.display` 34/38, `title` 28/32, `heading` 22/27 | A newspaper serif reads as a record that someone reported and set. It is not a default font that templates ship with. |
| Type: the state's words | Newsreader italic, `serifType.quote` 18/25 | Quoted text (the inspector's and the law's) gets its own voice, so a parent can tell our plain summary from the state's words at a glance |
| Type: data + UI | **Public Sans** 400–700, the U.S. Web Design System face, eight styles, **tabular numerals** for every count and date | Civic, neutral, and the numbers line up in columns |
| Section head | `SectionHead`: 1.5 pt ink rule across the column, then a sentence-case serif heading | Replaces the uppercase tracked eyebrow, which is the most common generated-UI tic |
| Neutrals | paper `#F7F6F2`, surface `#FFF`, ink `#1B1A17`, secondary `#55524A` · dark: `#121210` / `#1C1B19` / `#EEECE6` | Warm paper reads as a document. Secondary text clears AA on every surface. |
| Accent | deep teal `#1D5A54` (dark `#86CABF`) | Used only for actions: Watch, links, the selected tab, a watched pin. Never used for data. |
| Risk ramp (light) | High `#8A1F12` · Medium High `#A8460F` · Medium `#8A6400` · Medium Low `#4D6472` · Low `#6B675E` | Warm and dark means a higher-risk rule; cool and gray means lower. High is the darkest step, so it still separates under deuteranopia. Every step clears 4.5:1 on paper, surface, and sunken. |
| Risk ramp (dark) | `#FF7B66` · `#E89A58` · `#CDB46A` · `#93A9B5` · `#928E86` | High is the most saturated step and Low the dimmest. Every step is at least 5.3:1. |
| Spacing | 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 | 4 pt grid |
| Shape | radius 6/10/14, hairline borders, **no shadows** | A flat document, not cards floating over a void |
| Motion | 150 / 220 / 360 ms, ease-out entrances, 18 ms stagger, nothing loops, all off with Reduce Motion | Marks rise into place once. Disclosure and press feedback only. |
| Haptics | selection on taps, strip columns, and quote disclosure · success on Watch and on granting alerts | It confirms the two moments that matter: watching a daycare and turning on alerts |
| Loading | skeleton blocks shaped like the content | Never spinners |

## 6. The record strip (`components/ui/RecordStrip.tsx`), our signature

```
 ▯                                 ▯▯▯   <- outlined: not yet verified by the state
 ▮       ▮▮▮                       ▯▯▯
 ▮ •     ▮▮▮▮      •   •           ▯▯▯   <- one mark per finding, higher-risk rules at the bottom
─┴───────┴─────────┴───┴───────────┴──   <- each column sits at its visit date; • = visit, no findings posted
 Oct 2024          2025              Today
```
- **Reads in two seconds:** how often the state came, when findings clustered, and what is still open. It is a count over time, never a grade. The marks are never summed into a single color, and pins never encode findings.
- `full` variant: record page and onboarding, with time axis, key, and tappable columns that jump to that visit. `compact` variant: map callout, Watching, and list rows (once `visits_24mo` ships).
- Screen readers hear one sentence: "4 state visits in the last 24 months. 9 findings from 3 visits. 1 on a High risk rule. 3 not yet verified by the state."
- Busy records narrow the columns so the history still fits. Stacks taller than 9 show `+n`.

## 7. Onboarding (`app/onboarding/`), three screens, real data only

| # | Screen | What's on it |
|---|---|---|
| 1 | Why | "Texas inspects daycares every few months." A live strip of a real Rockwall center (shown by type and city, never by name) and a three-line key built from its own numbers |
| 2 | Find | Search (name, city, ZIP) or location, then pick one daycare. The pick is radio-style with an accent rail, and the button says "Watch <name>" |
| 3 | Alerts | That daycare's last visit with findings, drawn as the alert it would have sent and marked "Example". Then three plain facts, the note about the state's own email updates, and only then the OS prompt |

Progress uses the strip's own marks (solid for done, outlined for ahead). "Skip" and "Just looking" work on every screen.

## 8. Map (`theme/mapStyle.ts`)
The base is OpenFreeMap vector tiles redrawn in paper and ink: water, parks, roads by weight, and town names, with no POIs, buildings, or shields. Pins are uniform ink dots on a paper ring, and a watched daycare gets the accent and a larger ring.

**Banned:** gradients, glass, emoji, shadows used for decoration, sparkle icons, a green "all clear", letter or number grades, uppercase tracked eyebrows, identical boxed cards.
