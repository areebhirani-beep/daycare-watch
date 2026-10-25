# Figures

Drawn by [`scripts/figures.py`](../scripts/figures.py) straight from the loaded state files (pulled Oct 25 2026). Each figure's n, source, plotted numbers (CSV), and exact SQL are in [`docs/figures/README.md`](figures/README.md). A count of findings is not a verdict on a daycare, and no figure names or rates one.

**From the state's files to the app.** 14,977 operations rows → 14,310 daycares in scope → 379 active inside TX-04 by map point; 133,739 finding rows → 118,294 at in-scope daycares, all 118,294 joined to their visit.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="figures/data-funnel-dark.svg">
  <img src="figures/data-funnel-light.svg" alt="Bars from the state's raw row counts to in-scope daycares, visits and findings, findings joined to their visit, and daycares inside TX-04" width="100%">
</picture>

**Where the 379 are.** 234 licensed centers drawn as dots; 145 home daycares shown only as counts per 5 km hexagon, never as points.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="figures/tx04-map-dark.svg">
  <img src="figures/tx04-map-light.svg" alt="Map of TX-04 with one dot per active licensed center and home daycares shown only as counts per hexagon" width="100%">
</picture>

**Findings per month, statewide, by the state's risk level for the rule.** Nov 2021 to Sep 2026: 1,364 to 2,523 a month (median 1,955).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="figures/findings-by-month-dark.svg">
  <img src="figures/findings-by-month-light.svg" alt="Stacked monthly columns of state findings at Texas daycares, split by the state's risk level for the rule" width="100%">
</picture>

**What the rules were about.** Paperwork is the largest category statewide (31.1%) and in TX-04 (36.3%); Safety hazards are 28.1% statewide and 22.5% in TX-04 (n = 118,294 and 3,016).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="figures/categories-dark.svg">
  <img src="figures/categories-light.svg" alt="Dot plot of the share of findings in each rule category, statewide and in TX-04" width="100%">
</picture>

**Did the state check the fix?** Of 49,768 findings in the last 24 months, the state recorded checking the fix on 89.1%, 10.0% were fixed during the visit, and 0.8% have neither on record yet. This is why the app says "Fixed" only with one of those two.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="figures/fix-follow-through-dark.svg">
  <img src="figures/fix-follow-through-light.svg" alt="Share of findings where the state recorded checking the fix, fixed during the visit, or neither yet, by risk level" width="100%">
</picture>

**One rule, followed over time.** 26 TAC §746.2905(1), a center must not force a child to sleep [[10]](SOURCES.md#references): cited 123 times statewide from Q1 2022 to Q3 2026, 8 of them inside TX-04.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="figures/nap-rule-dark.svg">
  <img src="figures/nap-rule-light.svg" alt="Quarterly citations of rule 746.2905(1), TX-04 and the rest of Texas" width="100%">
</picture>

**Not charted:** days from inspection to posting. It is not measured yet, so there is no figure and no estimate ([why](figures/README.md#not-charted-days-from-inspection-to-posting)).
