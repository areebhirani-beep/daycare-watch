# North Texas context

Why a tool like this matters in TX-04: more young children, more working parents, and more daycares to check. Every number below is from a U.S. Census Bureau or Children at Risk file, recomputed from the raw file on Oct 25 2026.

**Read these as county numbers, not district numbers.** TX-04 (119th Congress) covers all of Delta, Fannin, Grayson, Hopkins, Lamar, Rains, and Rockwall counties and only part of Collin, Denton, Hunt, Red River, and Bowie ([`tx04_cd119.geojson`](../services/pipeline/data/tx04_cd119.geojson)). The Census figures below are for whole counties.

| Fact | Number | Source |
|---|---|---|
| Collin County added the second-most people of any U.S. county, Jul 2024 to Jul 2025 | +42,966 (1,254,213 → 1,297,179); only Harris County added more (+48,695) | Census Vintage 2025 county estimates, `co-est2025-alldata.csv`, field `NPOPCHG2025` [1] |
| Children under 5 are growing far faster here than in Texas as a whole, Apr 2020 to Jul 2025 | Collin 63,881 → 74,067 (+15.9%) · Rockwall 6,664 → 8,290 (+24.4%) · Hunt 6,108 → 8,395 (+37.4%) · Denton 54,753 → 60,803 (+11.0%) · Texas 1,947,812 → 1,992,611 (+2.3%) | Census Vintage 2025 age and sex estimates for Texas, `cc-est2025-agesex-48.csv`, field `UNDER5_TOT`, `YEAR` 1 vs 7 [2] |
| About two in three Collin children under 6 have every parent in the labor force | 57,162 (± 5,800) of 84,432. Denton 68.0%, Texas 65.6%. "Labor force" includes parents looking for work | American Community Survey 2024 1-year, table B23008 [3] |
| Births in one year, Jul 2024 to Jun 2025 | Collin 13,302 (about 36 a day) · Denton 11,614 | `co-est2025-alldata.csv`, field `BIRTHS2025` [1] |
| The rural part of the district already lacks child care | 23 of the 75 ZIP codes touching the 7 counties wholly inside TX-04 are 2025 child care deserts, and 19 of those 23 have been deserts in each of 2023, 2024, and 2025. A desert: children under 6 with working parents outnumber licensed capacity more than 3 to 1 | Children at Risk, 2026 Child Care Deserts analysis and ZIP list [4] |

**What these numbers do not say.** No ZIP code touching Collin or Rockwall is a child care desert in the 2025 data; the shortage is a rural-county story. In Collin the story is volume: more children, more working parents, and more daycare records for a parent to read. The daycare counts in this project come only from the state's files: at least 379 active daycares inside TX-04 by map point ([`METHODS.md`](METHODS.md#the-data)).

## Sources

All opened Oct 25 2026.

1. U.S. Census Bureau, Vintage 2025 county population totals: https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv · release: https://www.census.gov/newsroom/press-releases/2026/2025-popest-metro-micro-counties.html
2. U.S. Census Bureau, Vintage 2025 county population by age and sex, Texas: https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/asrh/cc-est2025-agesex-48.csv
3. U.S. Census Bureau, American Community Survey 2024 1-year, table B23008 (cells 004 + 010 + 013 over 002): https://data.census.gov/table/ACSDT1Y2024.B23008?g=050XX00US48085
4. Children at Risk, *2026 Child Care Deserts Analysis*, published Apr 9 2026: https://childrenatrisk.org/2026-child-care-deserts-analysis/ · ZIP list: https://childrenatrisk.org/wp-content/uploads/2026/04/2026_raw_chronic_deserts.pdf
