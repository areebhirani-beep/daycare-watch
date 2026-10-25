-- daycares_near carries only what the home map and its list draw: pins, the row title and meta line,
-- the visit strip, the TX-04 badge and the imagery rule. Street, ZIP, county, capacity and geocode
-- source come from daycare_record when a place opens. At most 150 rows, picked nearest first by the
-- GiST index (KNN `<->`) instead of computing and sorting every distance inside the radius.
drop function if exists public.daycares_near(float8, float8, float8, jsonb);

create function public.daycares_near(lat float8, lng float8, km float8 default 10, filters jsonb default '{}')
returns table (
  operation_id bigint, name text, operation_type text, city text,
  lat float8, lng float8, distance_km float8,
  last_inspection_date date, findings_24mo int, in_district boolean, district_basis text,
  visits_24mo jsonb, geocode_quality text
)
language sql stable security definer set search_path = ''
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
     order by d.geom operator(extensions.<->) o.g
     limit 150
  )
  select r.operation_id, r.name, r.operation_type, r.city,
         r.lat, r.lng,
         case when r.operation_type = 'Licensed Center' then h.dist_m / 1000.0
              else round((extensions.st_distance(
                     extensions.st_setsrid(extensions.st_makepoint(r.lng, r.lat), 4326)::extensions.geography,
                     o.g) / 1000.0)::numeric, 1)::float8 end,
         r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis, coalesce(dv.visits_24mo, '[]'::jsonb),
         r.geocode_quality
    from hits h
    cross join origin o
    join core.daycare_rows r on r.operation_id = h.operation_id
    left join core.daycare_visits dv on dv.operation_id = h.operation_id
   order by h.dist_m
$$;

revoke all on function public.daycares_near(float8, float8, float8, jsonb) from public, service_role;
grant execute on function public.daycares_near(float8, float8, float8, jsonb) to anon, authenticated;
