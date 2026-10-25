# Data figures

Every chart here is drawn by [`scripts/figures.py`](../../scripts/figures.py) from the project database, which holds the state's own files from data.texas.gov. Nothing is typed in by hand: the numbers in this page are written by the same script, from the same queries, on the same run.

```bash
uv run scripts/figures.py          # needs the local Supabase stack loaded by the pipeline
DATABASE_URL=postgresql://... uv run scripts/figures.py
```

Data pulled **Oct 25, 2026** (the newest successful pipeline run in `ops.sync_runs`, Texas time; `SQL_SOURCE_RUN`). Each figure comes in a light and a dark SVG and a CSV of the plotted numbers. Re-running on the same data rewrites identical files.

**Ground rules on every figure.** A count of findings is not a verdict on a daycare; no figure names, scores, ranks, or rates a daycare. Risk level is the state's weight for the rule that was cited, not a rating of the daycare. TX-04 means the daycare's map point is inside the Census TIGERweb CD119 boundary; the state's county field is never used to claim the district. Home daycares are never drawn as points.

**Time window.** The state's visit file holds about five years. On this pull, 546 visits are dated in the week starting Oct 25, 2021 (five years before the pull) and 95 in the week before it; the oldest visit is dated May 22, 2021 (`SQL_WINDOW`). Time series therefore start at the first whole month after Oct 25, 2021 and end at the last whole month before the newest finding (Oct 22, 2026).

**Whose findings.** 0 finding rows in the state's file lack a row in its operations file, and 36 of that file's 14,977 rows are marked not active. So the files appear to cover daycares on the state's current list only: findings at daycares that have since closed are likely missing, and older periods may count fewer findings for that reason alone.

`SQL_SOURCE_RUN`

```sql
select (finished_at at time zone 'America/Chicago')::date as pulled_on,
       stage_counts,
       join_rate
from ops.sync_runs
where ok
  and finished_at is not null
  and mode not like '%dry-run%'
order by finished_at desc
limit 1
```

`SQL_WINDOW`

```sql
with run as (
  select run_id, (finished_at at time zone 'America/Chicago')::date as pulled_on
  from ops.sync_runs
  where ok and finished_at is not null and mode not like '%dry-run%'
  order by finished_at desc
  limit 1
)
select (date_trunc('month', pulled_on - interval '5 years') + interval '1 month')::date as first_month,
       (date_trunc('month', (select max(activity_date) from core.violations))
          - interval '1 month')::date as last_month,
       (select min(activity_date) from core.inspections) as oldest_visit,
       (select max(activity_date) from core.violations) as newest_finding,
       (pulled_on - interval '5 years')::date as five_years_before_pull,
       (select count(*) from core.inspections
          where activity_date >= pulled_on - interval '5 years'
            and activity_date <  pulled_on - interval '5 years' + interval '7 days')
         as visits_first_week_inside,
       (select count(*) from core.inspections
          where activity_date >= pulled_on - interval '5 years' - interval '7 days'
            and activity_date <  pulled_on - interval '5 years')
         as visits_last_week_before,
       (select count(*) from staging.violations v
          where v.run_id = run.run_id
            and not exists (select 1 from staging.operations o
                              where o.run_id = v.run_id
                                and o.raw->>'operation_id' = v.operation_id))
         as findings_without_operation,
       (select count(*) from staging.operations o
          where o.run_id = run.run_id and o.raw->>'operation_status' <> 'Y')
         as operations_not_active,
       (select count(*) from staging.operations o where o.run_id = run.run_id)
         as operations_rows
from run
```

## 1. Active daycares inside TX-04

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="tx04-map-dark.svg">
  <img alt="Map of Texas congressional district 4 with one dot per active licensed child-care center, and home daycares shown only as counts per 5 km hexagon" src="tx04-map-light.svg" width="100%">
</picture>

**Finding.** 379 active daycares have a map point inside TX-04: 234 licensed centers (one dot each) and 145 home daycares, shown only as counts across 44 hexagons with 5 km sides (at most 20 in one hexagon). 23 more active daycares in TX-04 counties have no map point and are not drawn. There is no street map underneath and no address anywhere on the figure.

**n.** 379 daycares (234 centers, 145 homes).

**Table view.** [`tx04-map.csv`](tx04-map.csv)

**SQL** (from `scripts/figures.py`)

`SQL_MAP_DISTRICT`

```sql
select name,
       ST_AsGeoJSON(ST_ForcePolygonCCW(ST_Simplify(ST_Transform(geom::geometry, 3083), 100)), 0) as outline
from geo.districts
where id = 'TX-04'
```

`SQL_MAP_CENTERS`

```sql
select round(ST_X(ST_Transform(geom::geometry, 3083))::numeric, -2)::float8 as x,
       round(ST_Y(ST_Transform(geom::geometry, 3083))::numeric, -2)::float8 as y
from core.daycares
where operation_type = 'Licensed Center'
  and operation_status = 'Y'
  and in_district
  and district_basis = 'point'
order by x, y
```

`SQL_MAP_HOME_HEXES`

```sql
with homes as (
  select operation_id, ST_Transform(geom::geometry, 3083) as p
  from core.daycares
  where operation_type <> 'Licensed Center'
    and operation_status = 'Y'
    and in_district
    and district_basis = 'point'
),
cell as (
  select h.operation_id, x.i, x.j, x.geom
  from homes h
  cross join lateral (
    select i, j, geom from ST_HexagonGrid(5000, h.p) order by i, j limit 1
  ) x
)
select i, j, ST_AsGeoJSON(geom, 0) as hex, count(*) as homes
from cell
group by i, j, geom
order by i, j
```

`SQL_MAP_UNPLACED`

```sql
select count(*) filter (where operation_type = 'Licensed Center') as centers,
       count(*) filter (where operation_type <> 'Licensed Center') as homes
from core.daycares
where operation_status = 'Y'
  and in_district
  and district_basis = 'county'
```

**Embed** (paths from the repo root)

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/tx04-map-dark.svg">
  <img alt="Map of Texas congressional district 4 with one dot per active licensed child-care center, and home daycares shown only as counts per 5 km hexagon" src="docs/figures/tx04-map-light.svg" width="100%">
</picture>
```

## 2. Findings per month, statewide, by risk level

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="findings-by-month-dark.svg">
  <img alt="Stacked monthly columns of state findings at Texas daycares, split by the state's risk level for the rule" src="findings-by-month-light.svg" width="100%">
</picture>

**Finding.** From Nov 2021 to Sep 2026, findings dated in one month ranged from 1,364 to 2,523 at in-scope daycares (median 1,955). By the state's risk level for the rule: High 28,829 (24.6%), Medium High 49,008 (41.9%), Medium 33,709 (28.8%), Medium Low 3,884 (3.3%), Low 1,594 (1.4%). Left out: 812 findings dated before Nov 2021 and 458 in the month in progress.

**n.** 117,024 of 118,294 loaded findings.

**Table view.** [`findings-by-month.csv`](findings-by-month.csv)

**SQL** (from `scripts/figures.py`)

`SQL_FINDINGS_BY_MONTH`

```sql
select date_trunc('month', activity_date)::date as month,
       risk_level::text as risk_level,
       count(*) as findings
from core.violations
where activity_date >= %(first_month)s
  and activity_date <  (%(last_month)s::date + interval '1 month')
group by 1, 2
order by 1, 2
```

`SQL_FINDINGS_OUTSIDE`

```sql
select count(*) filter (where activity_date <  %(first_month)s) as before_first,
       count(*) filter (where activity_date >= (%(last_month)s::date + interval '1 month')) as after_last,
       count(*) as all_findings
from core.violations
```

**Embed** (paths from the repo root)

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/findings-by-month-dark.svg">
  <img alt="Stacked monthly columns of state findings at Texas daycares, split by the state's risk level for the rule" src="docs/figures/findings-by-month-light.svg" width="100%">
</picture>
```

## 3. Rule categories, statewide vs TX-04

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="categories-dark.svg">
  <img alt="Dot plot of the share of findings in each rule category, statewide and in TX-04" src="categories-light.svg" width="100%">
</picture>

**Finding.** Paperwork is the largest category both statewide and in TX-04. The two widest gaps: Safety hazards 22.5% in TX-04 vs 28.1% statewide; Paperwork 36.3% in TX-04 vs 31.1% statewide. Shares by category:

| Category | Statewide | TX-04 |
|---|---:|---:|
| Paperwork | 31.1% | 36.3% |
| Safety hazards | 28.1% | 22.5% |
| Health & medication | 18.2% | 17.7% |
| Supervision | 9.0% | 8.9% |
| Background checks | 3.2% | 3.6% |
| Discipline | 2.9% | 3.9% |
| Staff-to-child ratio | 2.8% | 2.2% |
| Parent communication | 2.5% | 3.2% |
| Other | 2.3% | 1.7% |

**n.** 118,294 findings statewide; 3,016 at daycares inside TX-04 by map point.

**Table view.** [`categories.csv`](categories.csv)

**SQL** (from `scripts/figures.py`)

`SQL_CATEGORY_SHARES`

```sql
select v.category::text as category,
       count(*) as statewide,
       count(*) filter (where d.in_district and d.district_basis = 'point') as tx04
from core.violations v
join core.daycares d using (operation_id)
group by 1
order by 2 desc
```

**Embed** (paths from the repo root)

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/categories-dark.svg">
  <img alt="Dot plot of the share of findings in each rule category, statewide and in TX-04" src="docs/figures/categories-light.svg" width="100%">
</picture>
```

## 4. Fix follow-through, last 24 months

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="fix-follow-through-dark.svg">
  <img alt="Horizontal 100% bars: share of findings where the state recorded checking the fix, where it was fixed during the visit, or neither yet, overall and by risk level" src="fix-follow-through-light.svg" width="100%">
</picture>

**Finding.** Of 49,768 findings dated Oct 25, 2024 to Oct 22, 2026, the state recorded checking the fix on 44,354 (89.1%), 4,993 (10.0%) were fixed during the visit, and 421 (0.8%) have neither on record yet. Newer findings have had less time for a state check. Counted as the file states: 19 findings carry a check date after the pull date and 39 a check date before the visit date.

| Risk level | Findings | State checked | Fixed during visit | Neither yet |
|---|---:|---:|---:|---:|
| High | 12,607 | 92.8% | 6.8% | 0.4% |
| Medium High | 20,446 | 86.7% | 12.3% | 1.0% |
| Medium | 14,074 | 88.9% | 10.2% | 0.9% |
| Medium Low | 1,865 | 90.3% | 8.9% | 0.8% |
| Low | 776 | 95.4% | 4.1% | 0.5% |

**n.** 49,768 findings statewide.

**Table view.** [`fix-follow-through.csv`](fix-follow-through.csv)

**SQL** (from `scripts/figures.py`)

`SQL_FIX_FOLLOW_THROUGH`

```sql
with run as (
  select (finished_at at time zone 'America/Chicago')::date as pulled_on
  from ops.sync_runs
  where ok and finished_at is not null and mode not like '%dry-run%'
  order by finished_at desc
  limit 1
)
select v.risk_level::text as risk_level,
       count(*) as findings,
       count(*) filter (where v.verified_date is not null) as state_checked,
       count(*) filter (where v.verified_date is null and v.corrected_at_inspection) as fixed_during_visit,
       count(*) filter (where v.verified_date is null and not v.corrected_at_inspection) as neither_yet,
       count(*) filter (where v.verified_date is not null and v.corrected_at_inspection) as both,
       count(*) filter (where v.verified_date > run.pulled_on) as checked_after_pull,
       count(*) filter (where v.verified_date < v.activity_date) as checked_before_visit,
       min(v.activity_date) as first_date,
       max(v.activity_date) as last_date
from core.violations v, run
where v.activity_date >= run.pulled_on - interval '24 months'
group by v.risk_level
order by v.risk_level
```

**Embed** (paths from the repo root)

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/fix-follow-through-dark.svg">
  <img alt="Horizontal 100% bars: share of findings where the state recorded checking the fix, where it was fixed during the visit, or neither yet, overall and by risk level" src="docs/figures/fix-follow-through-light.svg" width="100%">
</picture>
```

## 5. Nap rule 746.2905(1) citations per quarter

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="nap-rule-dark.svg">
  <img alt="Quarterly columns of citations of Texas rule 746.2905(1), statewide, with the TX-04 part marked" src="nap-rule-light.svg" width="100%">
</picture>

**Finding.** The state cited rule 746.2905(1) 123 times from Q1 2022 to Q3 2026 (at most 13 in a quarter); 8 of those were at daycares inside TX-04 (Q3 2024: 1, Q3 2025: 1, Q2 2026: 2, Q3 2026: 4). The whole file holds 129 citations, 9 in TX-04.

**n.** 123 citations in whole quarters (129 in the file).

**Table view.** [`nap-rule.csv`](nap-rule.csv)

**SQL** (from `scripts/figures.py`)

`SQL_NAP_RULE_BY_QUARTER`

```sql
select date_trunc('quarter', v.activity_date)::date as quarter,
       count(*) as statewide,
       count(*) filter (where d.in_district and d.district_basis = 'point') as tx04,
       count(*) filter (where d.operation_type = 'Licensed Center') as at_centers
from core.violations v
join core.daycares d using (operation_id)
where v.standard_code = '746.2905(1)'
group by 1
order by 1
```

`SQL_NAP_RULE_TITLES`

```sql
select standard_code, standard_title, count(*) as findings
from core.violations
where standard_code = '746.2905(1)'
group by 1, 2
order by 1
```

**Embed** (paths from the repo root)

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/nap-rule-dark.svg">
  <img alt="Quarterly columns of citations of Texas rule 746.2905(1), statewide, with the TX-04 part marked" src="docs/figures/nap-rule-light.svg" width="100%">
</picture>
```

## 6. From the state's files to the app

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="data-funnel-dark.svg">
  <img alt="Horizontal bars from the state's raw row counts to in-scope daycares, visits and findings, findings joined to their visit, and daycares inside TX-04" src="data-funnel-light.svg" width="100%">
</picture>

**Finding.** Of 14,977 rows in the state's operations file, 14,310 are daycares in scope and 379 are active inside TX-04 by map point; of 133,739 finding rows, 118,294 are at in-scope daycares and 118,294 join to their state visit (join rate 1.000; the run recorded 1).

| Group | Stage | Count |
|---|---|---:|
| Daycares | Rows in the state's operations file | 14,977 |
| Daycares | Daycares in scope (4 daycare types) | 14,310 |
| Daycares | With a map point | 13,024 |
| Daycares | Active, inside TX-04 by map point | 379 |
| Visits | Rows in the state's activities file | 205,457 |
| Visits | Visits at in-scope daycares | 157,358 |
| Findings | Rows in the state's non-compliance file | 133,739 |
| Findings | Findings at in-scope daycares | 118,294 |
| Findings | Joined to their state visit | 118,294 |

**n.** Every row of the three state files in the newest run.

**Table view.** [`data-funnel.csv`](data-funnel.csv)

**SQL** (from `scripts/figures.py`)

`SQL_SOURCE_RUN`

```sql
select (finished_at at time zone 'America/Chicago')::date as pulled_on,
       stage_counts,
       join_rate
from ops.sync_runs
where ok
  and finished_at is not null
  and mode not like '%dry-run%'
order by finished_at desc
limit 1
```

`SQL_FUNNEL_CORE`

```sql
select (select count(*) from core.daycares) as daycares_in_scope,
       (select count(*) from core.daycares where geom is not null) as daycares_with_point,
       (select count(*) from core.daycares
          where operation_status = 'Y' and in_district and district_basis = 'point')
         as daycares_tx04_point,
       (select count(*) from core.inspections) as visits_in_scope,
       (select count(*) from core.violations) as findings_in_scope,
       (select count(*) from core.violations v
          where exists (select 1 from core.inspections i where i.activity_id = v.activity_id))
         as findings_joined_to_visit
```

**Embed** (paths from the repo root)

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/figures/data-funnel-dark.svg">
  <img alt="Horizontal bars from the state's raw row counts to in-scope daycares, visits and findings, findings joined to their visit, and daycares inside TX-04" src="docs/figures/data-funnel-light.svg" width="100%">
</picture>
```

## Not charted: days from inspection to posting

This is not measured yet, so there is no figure and no estimate. The pipeline measures it from findings that first appear after the backfill (`ops.sync_runs.lag_*`); across 7 successful runs it has had 0 such findings, so those columns are empty (`SQL_LAG_STATUS`). The state's own row timestamps cannot stand in for it: on Oct 25 2026, every one of the 133,739 rows in the findings dataset `tqgd-mf4x` carried the same Socrata `:created_at` (`2026-10-24T09:06:16.759Z`, the time of the nightly full reload), so they date the reload, not the posting. Checked with

```bash
curl -s "https://data.texas.gov/resource/tqgd-mf4x.json?\$select=:created_at,count(*)&\$group=:created_at&\$limit=5"
```

`SQL_LAG_STATUS`

```sql
select count(*) as ok_runs,
       count(lag_median_days) as runs_with_lag,
       coalesce(sum((stage_counts->>'lag_sample_violations')::int), 0) as lag_sample_violations
from ops.sync_runs
where ok
```

## Colors

The app's own palette: ink for the mark that matters (TX-04, licensed centers, a state check on record) and warm grays for context, with light and dark steps chosen for each surface (`#ffffff`, `#0d1117`). Risk level is ordinal, so it is one ramp from ink (High) to light gray (Low), in the state's order, never a set of hues. The map's hexagons use a gray ramp for counts. The app's yellow is left out, because in the app it means only watching and alerts. Labels on a filled bar are black or white, whichever reads on that fill; every chart has a CSV table view.
