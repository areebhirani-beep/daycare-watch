-- district_recent_visits: TX-04 by point only, newest first up to the last complete week,
-- home daycares never expose name, and finding counts match core.
begin;
create extension if not exists pgtap with schema extensions;
-- Real records the asserts below name, so they hold on a fresh clone too (rolled back with the test).
\ir fixtures/real_rows.psql
-- Pin today so "last week" stays the week those visits happened, whenever the test runs.
create or replace function core.today() returns date language sql stable set search_path = ''
as $$ select date '2026-10-25' $$;
select plan(10);

select ok(has_function_privilege('anon', 'public.district_recent_visits(integer)', 'execute'),
          'anon can call district_recent_visits');

create temp table rv on commit drop as select * from public.district_recent_visits(50);

select ok((select count(*) between 1 and 50 from rv), 'returns between 1 and p_limit rows');
select is((select count(*) from public.district_recent_visits()), 6::bigint, 'default limit is 6');

select is(
  (select count(*) from rv join core.daycares d using (operation_id)
    where not (d.in_district and d.district_basis = 'point')),
  0::bigint, 'only daycares inside TX-04 by geocoded point');

select is(
  (select count(*) from rv
    where date > (date_trunc('week', core.today()::timestamp) - interval '1 day')::date),
  0::bigint, 'no visit after the end of the last complete week');

select is(
  (select count(*) from (select date, lag(date) over (order by ord) as prev
                           from (select date, row_number() over () as ord from rv) s) t
    where t.prev < t.date),
  0::bigint, 'newest first');

select is(
  (select count(*) from rv where is_home and name is not null),
  0::bigint, 'home daycares never return a name');

select is(
  (select count(*) from rv r join core.daycares d using (operation_id)
    where r.is_home and r.display_name like '%' || d.name || '%'),
  0::bigint, 'home daycare labels never contain the name');

select is(
  (select count(*) from rv r
    where r.findings_posted_so_far <> (select count(*) from core.violations v where v.activity_id = r.activity_id)),
  0::bigint, 'findings_posted_so_far matches core.violations for that visit');

select is(
  (select count(*) from rv r
    where (r.findings_posted_so_far = 0) <> (cardinality(r.categories) = 0)),
  0::bigint, 'categories are empty exactly when no findings are posted');

select * from finish();
rollback;
