-- daycare_search tolerates typos ("Montesori", "Lionhart", "Kinder Care").
--   1. Exact name/city/ZIP/address matches, plus names whose words are trigram-similar to the
--      query at the default word-similarity threshold (0.6, served by daycares_name_trgm).
--   2. Only when step 1 finds nothing: a looser pass at word similarity >= 0.5 (a scan, ~50 ms,
--      paid only by queries that would otherwise show "no results").
-- Exact matches still rank first. Same signature and grants as before.
-- No function here SETs an extension GUC: cloud roles are not allowed to.

-- Address and ZIP matches were sequential scans; trigram indexes serve the ILIKE / LIKE patterns.
create index if not exists daycares_address_trgm on core.daycares using gin (address extensions.gin_trgm_ops);
create index if not exists daycares_zip_trgm on core.daycares using gin (zip extensions.gin_trgm_ops);

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
    select d.operation_id, d.name, d.city, d.zip, d.address
      from core.daycares d, term t
     where length(t.raw) >= 2
       and d.operation_type = any (core.in_scope_types())
       and (   d.name ilike '%' || t.esc || '%'
            or d.city ilike t.esc
            or d.zip like t.esc || '%'
            or d.address ilike '%' || t.esc || '%')
    union
    select d.operation_id, d.name, d.city, d.zip, d.address
      from core.daycares d, term t
     where length(t.raw) >= 3
       and d.operation_type = any (core.in_scope_types())
       and t.raw operator(extensions.<%) d.name
  ),
  loose as (
    select d.operation_id, d.name, d.city, d.zip, d.address
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
            or c.zip like t.esc || '%' or c.address ilike '%' || t.esc || '%') as exact_hit,
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
