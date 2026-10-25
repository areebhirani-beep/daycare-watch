-- Home daycares are private residences. Enforce the CONTRACT privacy rule on the server, so the
-- public API (and the public web link) never hands out a house: for every operation type other
-- than 'Licensed Center', DaycareRow/DaycareHeader return
--   address  = null                         (city and ZIP stay)
--   lat, lng = rounded to 2 decimals (~1 km) (enough for a neighborhood map, never a house)
-- and daycares_near measures distance from that rounded point, to 0.1 km.
-- Centers are unchanged. Column names and types are unchanged.

create or replace view core.daycare_rows with (security_invoker = true) as
select
  d.operation_id,
  d.name,
  d.operation_type,
  case when d.operation_type = 'Licensed Center' then d.address end as address,
  d.city,
  d.zip,
  d.county,
  case when d.operation_type = 'Licensed Center' then extensions.st_y(d.geom::extensions.geometry)
       else round(extensions.st_y(d.geom::extensions.geometry)::numeric, 2)::float8 end as lat,
  case when d.operation_type = 'Licensed Center' then extensions.st_x(d.geom::extensions.geometry)
       else round(extensions.st_x(d.geom::extensions.geometry)::numeric, 2)::float8 end as lng,
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

create or replace function public.daycares_near(
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
         r.lat, r.lng,
         case when r.operation_type = 'Licensed Center' then h.dist_m / 1000.0
              else round((extensions.st_distance(
                     extensions.st_setsrid(extensions.st_makepoint(r.lng, r.lat), 4326)::extensions.geography,
                     o.g) / 1000.0)::numeric, 1)::float8 end,
         r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb),
         r.geocode_source, r.geocode_quality
    from hits h
    cross join origin o
    join core.daycare_rows r on r.operation_id = h.operation_id
    left join core.daycare_visits dv on dv.operation_id = h.operation_id
   order by h.dist_m
$$;

-- daycare_search never matches a home on its street address (a query for a home's street must not find it).
create or replace function public.daycare_search(q text)
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
  -- Two index-friendly branches, unioned (an OR across them would defeat the indexes).
  candidates as (
    select d.operation_id, d.name, d.city, d.zip, d.address, d.operation_type
      from core.daycares d, term t
     where length(t.raw) >= 2
       and d.operation_type = any (core.in_scope_types())
       and (   d.name ilike '%' || t.esc || '%'
            or d.city ilike t.esc
            or d.zip like t.esc || '%'
            or (d.operation_type = 'Licensed Center' and d.address ilike '%' || t.esc || '%'))
    union
    select d.operation_id, d.name, d.city, d.zip, d.address, d.operation_type
      from core.daycares d, term t
     where length(t.raw) >= 3
       and d.operation_type = any (core.in_scope_types())
       and t.raw operator(extensions.<%) d.name
  ),
  loose as (
    select d.operation_id, d.name, d.city, d.zip, d.address, d.operation_type
      from core.daycares d, term t
     where length(t.raw) >= 3
       and not exists (select 1 from candidates)
       and d.operation_type = any (core.in_scope_types())
       and extensions.word_similarity(t.raw, d.name) >= 0.5
  ),
  hits as (
    select c.operation_id,
           (c.zip like t.esc || '%') as zip_hit,
           (c.name ilike t.esc || '%') as prefix_hit,
           (   c.name ilike '%' || t.esc || '%' or c.city ilike t.esc
            or c.zip like t.esc || '%'
            or (c.operation_type = 'Licensed Center' and c.address ilike '%' || t.esc || '%')) as exact_hit,
           extensions.word_similarity(t.raw, c.name) as sim
      from (select * from candidates union all select * from loose) c, term t
     order by zip_hit desc, prefix_hit desc, exact_hit desc, sim desc, c.name
     limit 50
  )
  select r.operation_id, r.name, r.operation_type, r.address, r.city, r.zip, r.county,
         r.lat, r.lng, null::float8, r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb),
         r.geocode_source, r.geocode_quality
    from hits h
    join core.daycare_rows r on r.operation_id = h.operation_id
    left join core.daycare_visits dv on dv.operation_id = h.operation_id
   order by h.zip_hit desc, h.prefix_hit desc, h.exact_hit desc, h.sim desc, r.name
$$;
