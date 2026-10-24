-- Read models: the shared DaycareRow view, per-daycare stats, area medians, and the weekly
-- district pulse. Materialized views each carry a unique index so the pipeline can
-- REFRESH ... CONCURRENTLY (through core.refresh_aggregates()) without blocking readers.

-- The four operation types that are daycares. Child Placing Agencies and General
-- Residential Operations (foster/residential care) are out of scope.
create or replace function core.in_scope_types()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['Licensed Center', 'Licensed Child-Care Home', 'Listed Family Home', 'Registered Child-Care Home'] $$;

revoke all on function core.in_scope_types() from public, anon, authenticated;

-- DaycareRow (CONTRACT 4.1) minus distance_km, which depends on the caller's location.
-- last_inspection_date covers every state visit type (inspection, report, assessment).
create or replace view core.daycare_rows with (security_invoker = true) as
select
  d.operation_id,
  d.name,
  d.operation_type,
  d.address,
  d.city,
  d.zip,
  d.county,
  extensions.st_y(d.geom::extensions.geometry) as lat,
  extensions.st_x(d.geom::extensions.geometry) as lng,
  d.capacity,
  (select max(i.activity_date)
     from core.inspections i
    where i.operation_id = d.operation_id) as last_inspection_date,
  (select count(*)::integer
     from core.violations v
    where v.operation_id = d.operation_id
      and v.activity_date >= (core.today() - interval '24 months')::date) as findings_24mo,
  d.in_district,
  d.district_basis
from core.daycares d;

revoke all on core.daycare_rows from public, anon, authenticated;
grant select on core.daycare_rows to service_role;

-- Per-daycare counts over the last 24 months, for active in-scope daycares.
-- "inspections" counts every state visit; "findings_high" counts risk level High only.
create materialized view if not exists core.daycare_stats as
with w as (select (core.today() - interval '24 months')::date as since)
select
  d.operation_id,
  d.county,
  d.operation_type,
  coalesce(i.inspections, 0)::integer                as inspections,
  coalesce(i.inspections_with_findings, 0)::integer  as inspections_with_findings,
  coalesce(v.findings, 0)::integer                   as findings,
  coalesce(v.findings_high, 0)::integer              as findings_high
from core.daycares d
cross join w
left join lateral (
  select count(*) as inspections,
         count(*) filter (where i.violation_found = 'Yes') as inspections_with_findings
    from core.inspections i
   where i.operation_id = d.operation_id and i.activity_date >= w.since
) i on true
left join lateral (
  select count(*) as findings,
         count(*) filter (where v.risk_level = 'High') as findings_high
    from core.violations v
   where v.operation_id = d.operation_id and v.activity_date >= w.since
) v on true
where d.operation_type = any (core.in_scope_types())
  and d.operation_status is distinct from 'N';

create unique index if not exists daycare_stats_pk on core.daycare_stats (operation_id);
create index if not exists daycare_stats_area_idx on core.daycare_stats (county, operation_type);

-- Medians for the same operation type in the same county.
create materialized view if not exists core.area_medians as
select
  s.county,
  s.operation_type,
  count(*)::integer as peer_count,
  percentile_cont(0.5) within group (order by s.inspections)               as median_inspections,
  percentile_cont(0.5) within group (order by s.inspections_with_findings) as median_inspections_with_findings,
  percentile_cont(0.5) within group (order by s.findings)                  as median_findings,
  percentile_cont(0.5) within group (order by s.findings_high)             as median_findings_high
from core.daycare_stats s
where s.county is not null
group by s.county, s.operation_type;

create unique index if not exists area_medians_pk on core.area_medians (county, operation_type);

-- Weekly (Mon-Sun) totals for in-scope daycares located inside TX-04 by point-in-polygon.
-- Weeks are keyed by the visit date, not by when the state posted the finding.
create materialized view if not exists core.district_pulse_weekly as
with dd as (
  select operation_id
    from core.daycares
   where in_district
     and district_basis = 'point'
     and operation_type = any (core.in_scope_types())
),
visits as (
  select date_trunc('week', i.activity_date::timestamp)::date as week_start,
         count(*)::integer as visits,
         count(*) filter (where i.violation_found = 'Yes')::integer as visits_with_findings,
         count(distinct i.operation_id)::integer as daycares_visited
    from core.inspections i
    join dd using (operation_id)
   group by 1
),
finds as (
  select date_trunc('week', v.activity_date::timestamp)::date as week_start,
         count(*)::integer as findings,
         count(*) filter (where v.risk_level = 'High')::integer as findings_high
    from core.violations v
    join dd using (operation_id)
   where v.activity_date is not null
   group by 1
),
cats as (
  select c.week_start,
         jsonb_agg(jsonb_build_object('category', c.category, 'n', c.n) order by c.n desc, c.category) as by_category
    from (
      select date_trunc('week', v.activity_date::timestamp)::date as week_start, v.category, count(*)::integer as n
        from core.violations v
        join dd using (operation_id)
       where v.activity_date is not null
       group by 1, 2
    ) c
   group by c.week_start
)
select
  week_start,
  coalesce(visits.visits, 0)               as visits,
  coalesce(visits.visits_with_findings, 0) as visits_with_findings,
  coalesce(visits.daycares_visited, 0)     as daycares_visited,
  coalesce(finds.findings, 0)              as findings,
  coalesce(finds.findings_high, 0)         as findings_high,
  coalesce(cats.by_category, '[]'::jsonb)  as by_category
from visits
full join finds using (week_start)
left join cats using (week_start);

create unique index if not exists district_pulse_weekly_pk on core.district_pulse_weekly (week_start);

revoke all on core.daycare_stats, core.area_medians, core.district_pulse_weekly from public, anon, authenticated;
grant select on core.daycare_stats, core.area_medians, core.district_pulse_weekly to service_role;

-- Pipeline stage 7: refresh in dependency order (area_medians reads daycare_stats).
create or replace function core.refresh_aggregates()
returns void
language plpgsql
set search_path = ''
as $$
begin
  refresh materialized view concurrently core.daycare_stats;
  refresh materialized view concurrently core.area_medians;
  refresh materialized view concurrently core.district_pulse_weekly;
end
$$;

revoke all on function core.refresh_aggregates() from public, anon, authenticated;

-- Pipeline stage 5: set in_district + district_basis for every daycare.
-- With a point: ST_Covers against the district polygon (basis 'point').
-- Without one: membership by county from p_fallback_counties (basis 'county').
-- Returns counts so the pipeline can log them.
create or replace function core.assign_district(
  p_district_id text default 'TX-04',
  p_fallback_counties text[] default '{}'
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_geom extensions.geography;
  v_result jsonb;
begin
  select g.geom into v_geom from geo.districts g where g.id = p_district_id;
  if v_geom is null then
    raise exception 'district % is not loaded in geo.districts', p_district_id using errcode = 'P0002';
  end if;

  update core.daycares d
     set in_district = case
                         when d.geom is not null then extensions.st_covers(v_geom, d.geom)
                         else upper(coalesce(d.county, '')) = any (
                           select upper(c) from unnest(p_fallback_counties) as c)
                       end,
         district_basis = case when d.geom is not null then 'point' else 'county' end;

  select jsonb_build_object(
           'point_in',    count(*) filter (where in_district and district_basis = 'point'),
           'point_out',   count(*) filter (where not in_district and district_basis = 'point'),
           'county_in',   count(*) filter (where in_district and district_basis = 'county'),
           'county_out',  count(*) filter (where not in_district and district_basis = 'county'))
    into v_result
    from core.daycares;
  return v_result;
end
$$;

revoke all on function core.assign_district(text, text[]) from public, anon, authenticated;
