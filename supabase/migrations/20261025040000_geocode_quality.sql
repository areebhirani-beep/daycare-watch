-- Geocode quality from the Census batch geocoder, so the app can say how a map point was placed:
--   geocode_source 'state'  -> location from the state record (quality null)
--   geocode_source 'census' -> quality 'exact' (street address matched as written)
--                              or 'non_exact' (matched after the geocoder corrected the address)

alter table core.daycares add column if not exists geocode_quality text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'core.daycares'::regclass and conname = 'daycares_geocode_quality_check') then
    alter table core.daycares add constraint daycares_geocode_quality_check
      check (geocode_quality in ('exact', 'non_exact'));
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'core.daycares'::regclass and conname = 'daycares_geocode_quality_census_only') then
    alter table core.daycares add constraint daycares_geocode_quality_census_only
      check (geocode_quality is null or geocode_source = 'census');
  end if;
end
$$;

-- DaycareRow gains geocode_source + geocode_quality (appended, so create or replace keeps the view).
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
  d.district_basis,
  d.geocode_source,
  d.geocode_quality
from core.daycares d;

revoke all on core.daycare_rows from public, anon, authenticated;
grant select on core.daycare_rows to service_role;

-- The row RPCs gain two output columns, which needs drop + create (a return type cannot be altered).
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
  visits_24mo jsonb, geocode_source text, geocode_quality text
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
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb),
         r.geocode_source, r.geocode_quality
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
  visits_24mo jsonb, geocode_source text, geocode_quality text
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
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb),
         r.geocode_source, r.geocode_quality
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
  visits_24mo jsonb, geocode_source text, geocode_quality text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.operation_id, r.name, r.operation_type, r.address, r.city, r.zip, r.county,
         r.lat, r.lng, null::float8, r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb),
         r.geocode_source, r.geocode_quality
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
