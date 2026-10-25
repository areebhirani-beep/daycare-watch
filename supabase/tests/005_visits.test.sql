-- DaycareRow.visits_24mo: matview shape, reconciliation with core, and exposure through the row RPCs.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select lives_ok('select core.refresh_aggregates()', 'refresh_aggregates refreshes daycare_visits concurrently');

select ok(exists (select 1 from pg_indexes where schemaname = 'core' and indexname = 'daycare_visits_pk'
                    and indexdef like 'CREATE UNIQUE%'), 'daycare_visits_pk is a unique index');

select ok(not has_table_privilege('anon', 'core.daycare_visits', 'select'), 'anon cannot read core.daycare_visits');
select ok(not has_table_privilege('authenticated', 'core.daycare_visits', 'select'), 'authenticated cannot read core.daycare_visits');

select is(
  (select count(*) from core.daycare_visits v, jsonb_array_elements(v.visits_24mo) e),
  (select count(*) from core.inspections where activity_date >= (core.today() - interval '24 months')::date),
  'one entry per state visit in the last 24 months');

select is(
  (select coalesce(sum((e ->> 'n')::int), 0)::bigint from core.daycare_visits v, jsonb_array_elements(v.visits_24mo) e),
  (select count(*) from core.violations v join core.inspections i using (activity_id)
    where i.activity_date >= (core.today() - interval '24 months')::date),
  'finding counts reconcile with core.violations');

select ok(
  coalesce(bool_and((e ->> 'n')::int = jsonb_array_length(e -> 'r')
                    and jsonb_array_length(e -> 'r') = jsonb_array_length(e -> 'o')), true),
  'n = length(r) = length(o) on every visit')
  from core.daycare_visits v, jsonb_array_elements(v.visits_24mo) e;

select is(
  (select count(*) from core.daycare_visits v, jsonb_array_elements(v.visits_24mo) e,
                        jsonb_array_elements(e -> 'o') o
    where o::int = 1),
  (select count(*) from core.violations v join core.inspections i using (activity_id)
    where i.activity_date >= (core.today() - interval '24 months')::date
      and not coalesce(v.corrected_at_inspection, false) and v.verified_date is null),
  'o = 1 exactly for findings neither corrected at the inspection nor verified');

select is(
  (select count(*) from core.daycare_visits v,
          lateral (select e ->> 'd' as d, lag(e ->> 'd') over (order by ord) as prev
                     from jsonb_array_elements(v.visits_24mo) with ordinality as x(e, ord)) s
    where s.prev > s.d),
  0::bigint,
  'visits are oldest first');

select is(
  (select count(*) from core.daycare_visits v, jsonb_array_elements(v.visits_24mo) e,
          lateral (select r::int as r, lag(r::int) over (order by ord) as prev
                     from jsonb_array_elements(e -> 'r') with ordinality as x(r, ord)) s
    where s.prev < s.r or s.r not between 1 and 5),
  0::bigint,
  'risk ranks are 1..5 and sorted high to low within a visit');

-- Through the API, as the app calls it.
set local role anon;

select is(
  (select pg_typeof(visits_24mo)::text from public.daycare_search('Rockwall') limit 1),
  'jsonb', 'daycare_search returns visits_24mo');

select ok(
  (select bool_and(jsonb_typeof(visits_24mo) = 'array')
     from public.daycares_near(32.93, -96.46, 10, '{}')),
  'daycares_near returns visits_24mo as an array on every row (never null)');

reset role;

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('daycares_near', 'daycare_search', 'my_watches')
      and has_function_privilege('anon', p.oid, 'execute')),
  array['daycare_search', 'daycares_near'],
  'grants restored: anon runs near + search, not my_watches');

select * from finish();
rollback;
