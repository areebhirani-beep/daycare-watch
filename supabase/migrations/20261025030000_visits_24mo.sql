-- DaycareRow.visits_24mo: one entry per state visit in the last 24 months, oldest first,
-- for the record strip on list rows and map callouts. Precomputed so the row RPCs stay cheap.
--   d = visit date, n = findings count,
--   r = per-finding risk rank (High 5, Medium High 4, Medium 3, Medium Low 2, Low 1),
--   o = 1 when the finding is neither corrected at the inspection nor verified by the state,
-- with r and o parallel and sorted by r desc, then o desc. Visits with no findings: n 0, r [], o [].

create materialized view if not exists core.daycare_visits as
with w as (select (core.today() - interval '24 months')::date as since)
select
  i.operation_id,
  jsonb_agg(jsonb_build_object(
              'd', i.activity_date,
              'n', coalesce(f.n, 0),
              'r', coalesce(f.r, '[]'::jsonb),
              'o', coalesce(f.o, '[]'::jsonb))
            order by i.activity_date, i.activity_at, i.activity_id) as visits_24mo
from core.inspections i
cross join w
left join lateral (
  select count(*)::integer as n,
         jsonb_agg(m.rank order by m.rank desc, m.open desc) as r,
         jsonb_agg(m.open order by m.rank desc, m.open desc) as o
    from (
      select case v.risk_level
               when 'High'        then 5
               when 'Medium High' then 4
               when 'Medium'      then 3
               when 'Medium Low'  then 2
               when 'Low'         then 1
             end as rank,
             case when coalesce(v.corrected_at_inspection, false) or v.verified_date is not null
                  then 0 else 1 end as open
        from core.violations v
       where v.activity_id = i.activity_id
    ) m
) f on true
where i.activity_date >= w.since
group by i.operation_id;

create unique index if not exists daycare_visits_pk on core.daycare_visits (operation_id);

revoke all on core.daycare_visits from public, anon, authenticated;
grant select on core.daycare_visits to service_role;

create or replace function core.refresh_aggregates()
returns void
language plpgsql
set search_path = ''
as $$
begin
  refresh materialized view concurrently core.daycare_stats;
  refresh materialized view concurrently core.area_medians;
  refresh materialized view concurrently core.district_pulse_weekly;
  refresh materialized view concurrently core.daycare_visits;
end
$$;

revoke all on function core.refresh_aggregates() from public, anon, authenticated;

-- The row RPCs gain one output column, which needs drop + create (a return type cannot be altered).
drop function if exists public.daycares_near(float8, float8, float8, jsonb);
drop function if exists public.daycare_search(text);
drop function if exists public.my_watches();

create function public.daycares_near(
  lat float8,
  lng float8,
  km float8 default 10,
  filters jsonb default '{}'
)
returns table (
  operation_id bigint, name text, operation_type text, address text, city text, zip text,
  county text, lat float8, lng float8, distance_km float8, capacity integer,
  last_inspection_date date, findings_24mo integer, in_district boolean, district_basis text,
  visits_24mo jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(
             extensions.st_makepoint(daycares_near.lng, daycares_near.lat), 4326
           )::extensions.geography as g
  ),
  f as (
    select
      coalesce(
        (select array_agg(t) from jsonb_array_elements_text(
           case when jsonb_typeof(daycares_near.filters -> 'types') = 'array'
                then daycares_near.filters -> 'types' end) as t),
        core.in_scope_types()) as types,
      case when jsonb_typeof(daycares_near.filters -> 'in_district') = 'boolean'
           then (daycares_near.filters ->> 'in_district')::boolean end as in_district,
      case when jsonb_typeof(daycares_near.filters -> 'subsidies') = 'boolean'
           then (daycares_near.filters ->> 'subsidies')::boolean end as subsidies,
      least(greatest(coalesce(daycares_near.km, 10), 0), 50) * 1000 as radius_m
  ),
  hits as (
    select d.operation_id, extensions.st_distance(d.geom, o.g) as dist_m
      from core.daycares d, origin o, f
     where d.geom is not null
       and extensions.st_dwithin(d.geom, o.g, f.radius_m)
       and d.operation_type = any (f.types)
       and d.operation_type = any (core.in_scope_types())
       and d.operation_status is distinct from 'N'
       and (f.in_district is null or d.in_district = f.in_district)
       and (f.subsidies is null or d.accepts_subsidies = f.subsidies)
     order by dist_m
     limit 200
  )
  select r.operation_id, r.name, r.operation_type, r.address, r.city, r.zip, r.county,
         r.lat, r.lng, h.dist_m / 1000.0, r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb)
    from hits h
    join core.daycare_rows r on r.operation_id = h.operation_id
    left join core.daycare_visits dv on dv.operation_id = h.operation_id
   order by h.dist_m
$$;

create function public.daycare_search(q text)
returns table (
  operation_id bigint, name text, operation_type text, address text, city text, zip text,
  county text, lat float8, lng float8, distance_km float8, capacity integer,
  last_inspection_date date, findings_24mo integer, in_district boolean, district_basis text,
  visits_24mo jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with term as (
    select btrim(coalesce(daycare_search.q, '')) as raw,
           -- escape LIKE wildcards in user input
           replace(replace(replace(btrim(coalesce(daycare_search.q, '')), '\', '\\'), '%', '\%'), '_', '\_') as esc
  ),
  hits as (
    select d.operation_id,
           (d.zip like t.esc || '%') as zip_hit,
           (d.name ilike t.esc || '%') as prefix_hit,
           extensions.similarity(d.name, t.raw) as sim
      from core.daycares d, term t
     where length(t.raw) >= 2
       and d.operation_type = any (core.in_scope_types())
       and (   d.name ilike '%' || t.esc || '%'
            or d.city ilike t.esc
            or d.zip like t.esc || '%'
            or d.address ilike '%' || t.esc || '%')
     order by zip_hit desc, prefix_hit desc, sim desc, d.name
     limit 50
  )
  select r.operation_id, r.name, r.operation_type, r.address, r.city, r.zip, r.county,
         r.lat, r.lng, null::float8, r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb)
    from hits h
    join core.daycare_rows r on r.operation_id = h.operation_id
    left join core.daycare_visits dv on dv.operation_id = h.operation_id
   order by h.zip_hit desc, h.prefix_hit desc, h.sim desc, r.name
$$;

create function public.my_watches()
returns table (
  operation_id bigint, name text, operation_type text, address text, city text, zip text,
  county text, lat float8, lng float8, distance_km float8, capacity integer,
  last_inspection_date date, findings_24mo integer, in_district boolean, district_basis text,
  visits_24mo jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.operation_id, r.name, r.operation_type, r.address, r.city, r.zip, r.county,
         r.lat, r.lng, null::float8, r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb)
    from app.watches w
    join core.daycare_rows r on r.operation_id = w.operation_id
    left join core.daycare_visits dv on dv.operation_id = w.operation_id
   where w.user_id = (select auth.uid())
   order by w.created_at desc, r.operation_id
$$;

revoke all on function public.daycares_near(float8, float8, float8, jsonb) from public, service_role;
revoke all on function public.daycare_search(text)                        from public, service_role;
revoke all on function public.my_watches()                                from public, anon, service_role;

grant execute on function public.daycares_near(float8, float8, float8, jsonb) to anon, authenticated;
grant execute on function public.daycare_search(text)                        to anon, authenticated;
grant execute on function public.my_watches()                                to authenticated;
