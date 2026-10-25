# Daycare Watch: design

**Direction: a public record, calmly told.** The app reads like a well-set government document that someone took the trouble to explain: warm paper, dark ink, one quiet accent, every fact dated and sourced. It never looks like a dashboard, and it never grades anything.

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

## 5. Design system (`src/theme/tokens.ts`)

| Token | Choice | Why |
|---|---|---|
| Type family | **Public Sans** (400/500/600/700), the U.S. Web Design System typeface | It's civic and neutral, and it isn't the Inter/SF default every template ships |
| Scale | largeTitle 30/36 · title 22/28 · headline 17/23 · body 17/25 · callout 15/21 · subhead 15/20 · footnote 13/18 · caption 12/16 | Eight styles only, tabular numerals for counts |
| Neutrals | paper `#F7F6F2`, surface `#FFF`, ink `#1B1A17`, secondary `#55524A` · dark: `#121210` / `#1C1B19` / `#EEECE6` | Warm paper reads as a document, and secondary text clears AA on every surface |
| Accent | deep teal `#1D5A54` (dark `#86CABF`) | Used only for actions: Watch, links, the selected tab. Never for data |
| Risk ramp | High `#A3321F` · Medium High `#9C4F12` · Medium `#76600F` · Medium Low `#4F5D66` · Low `#625F58` | Warm-to-neutral and ordered by lightness. Always paired with words and the five-mark glyph, so it holds up under protanopia and deuteranopia |
| Spacing | 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 | 4 pt grid |
| Shape | radius 6/10/14, hairline borders, **no shadows** | A flat document, not cards floating over a void |
| Motion | 150 ms / 220 ms ease-out, nothing at all with Reduce Motion | Disclosure and press feedback only |
| Loading | skeleton blocks shaped like the content | Never spinners |

**Banned:** gradients, glass, emoji, shadows used for decoration, sparkle icons, a green "all clear", and letter or number grades.
