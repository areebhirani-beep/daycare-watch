-- Home daycares: a 5-digit ZIP only. core.daycares.zip holds the state's ZIP+4 ("75072 ####"), and a ZIP+4 is a
-- delivery segment, often one side of one block, which would undo the ~1 km point rounding (docs/PRIVACY.md).
--   core.daycare_rows (and so daycare_search, daycares_near, daycare_record) returns left(zip, 5) for every
--   operation type other than 'Licensed Center'; centers are unchanged. Column names and types are unchanged.
--   daycare_search matches a home on its ZIP only for a query of 5 characters or fewer, so a ZIP+4 query
--   can't confirm a home. The zip LIKE stays as written so the index still serves it.

create or replace view core.daycare_rows with (security_invoker = true) as
select
  d.operation_id,
  d.name,
  d.operation_type,
  case when d.operation_type = 'Licensed Center' then d.address end as address,
  d.city,
  case when d.operation_type = 'Licensed Center' then d.zip else left(d.zip, 5) end as zip,
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

-- daycare_search never matches a home on its street, or on more than its 5-digit ZIP.
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
            or (d.zip like t.esc || '%' and (d.operation_type = 'Licensed Center' or length(t.raw) <= 5))
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
           (c.zip like t.esc || '%' and (c.operation_type = 'Licensed Center' or length(t.raw) <= 5)) as zip_hit,
           (c.name ilike t.esc || '%') as prefix_hit,
           (   c.name ilike '%' || t.esc || '%' or c.city ilike t.esc
            or (c.zip like t.esc || '%' and (c.operation_type = 'Licensed Center' or length(t.raw) <= 5))
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
