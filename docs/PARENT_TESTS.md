# Parent tests

Goal: 10 parents of young children use the app on a real phone before we film, and we write down what they did and said. No names, no contact details, no photos of faces without permission. Parents are P1 to P10.

## Before each session (2 minutes)
- Phone has the current build, signed in fresh, watching nothing. Between parents: Watching tab → long-press the "Watching" title for 1 second → Start over. This removes the last parent's watches and starts a fresh anonymous user at onboarding.
- Say: "This app shows what Texas state inspectors found at daycares. I'm testing the app, not you. Think out loud. You can stop any time."
- Ask permission to write down quotes word for word. If they say no, record task results only.

## Tasks (about 10 minutes)
Do not help unless they are stuck for 30 seconds. Note where they got stuck.

| # | Say this | Success looks like |
|---|---|---|
| T1 | "Find a daycare near you, or one you know." | Opens a daycare's page from the map or search |
| T2 | "In your own words, what did the state find at its most recent visit?" | Says the count, the date, and whether it was fixed, without reading the screen word for word |
| T3 | "Is anything here serious, according to the state?" | Points to the state's risk level on a finding |
| T4 | "You want to know if the state posts something new about this daycare. What would you do?" | Taps Watch and turns on alerts |
| T5 | (After they tap Allow in T4, send a labeled replay of the newest real finding at the daycare they watched with `pipeline sync --replay-latest <operation_id>`; the full command is in `supabase/OWNER_STEPS.md` section 4.) "You just got this. What is it telling you?" | Opens it and explains it is a past real record being replayed, plus what changed |
| T6 | "You want to see this daycare's inspection reports or drop in. What can you do?" | Finds the Your rights request and the share sheet |
| T7 | "You're touring this daycare tomorrow. What would you ask?" | Opens the tour questions and picks one |

## After (3 minutes)
1. "What would you do differently after seeing this?" (write the exact words)
2. "What was confusing?"
3. "Would you want this for your own child's daycare? Why or why not?"
4. "Did anything on screen feel unfair to the daycare?"

## Results

| Parent | Child's age range | T1 | T2 | T3 | T4 | T5 | T6 | T7 | Action they said they'd take | Confusing | Quote (with permission) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | | | |
| P2 | | | | | | | | | | | |
| P3 | | | | | | | | | | | |
| P4 | | | | | | | | | | | |
| P5 | | | | | | | | | | | |
| P6 | | | | | | | | | | | |
| P7 | | | | | | | | | | | |
| P8 | | | | | | | | | | | |
| P9 | | | | | | | | | | | |
| P10 | | | | | | | | | | | |

Mark each task ✓ (did it alone), ~ (needed a hint), or ✗ (could not). Report totals as counts only, for example "T2: 8 of 10 on their own".

## What we changed because of the tests

| Finding from tests | Change | Commit |
|---|---|---|
| | | |
