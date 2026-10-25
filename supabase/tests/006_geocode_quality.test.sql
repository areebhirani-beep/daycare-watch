-- geocode_quality: allowed values, census-only rule, and exposure on DaycareRow + DaycareHeader.
begin;
create extension if not exists pgtap with schema extensions;
-- Real records the asserts below name, so they hold on a fresh clone too (rolled back with the test).
\ir fixtures/real_rows.psql
select plan(8);

select has_column('core', 'daycares', 'geocode_quality', 'core.daycares.geocode_quality exists');

select lives_ok(
  $$update core.daycares set geocode_quality = 'exact'
     where operation_id = (select operation_id from core.daycares where geocode_source = 'census' limit 1)$$,
  'exact is allowed on a census point');

select lives_ok(
  $$update core.daycares set geocode_quality = 'non_exact'
     where operation_id = (select operation_id from core.daycares where geocode_source = 'census' limit 1)$$,
  'non_exact is allowed on a census point');

select throws_ok(
  $$update core.daycares set geocode_quality = 'approximate'
     where operation_id = (select operation_id from core.daycares where geocode_source = 'census' limit 1)$$,
  '23514', null, 'any other value is rejected');

select throws_ok(
  $$update core.daycares set geocode_quality = 'exact'
     where operation_id = (select operation_id from core.daycares where geocode_source = 'state' limit 1)$$,
  '23514', null, 'quality is rejected on a state-record point');

set local role anon;

select ok(
  (select to_jsonb(s) ?& array['geocode_source', 'geocode_quality']
     from public.daycare_search('Rockwall') s limit 1),
  'daycare_search returns geocode_source + geocode_quality');

select ok(
  (select count(*) > 0 from public.daycares_near(32.93, -96.46, 10, '{}') where geocode_quality is not null),
  'daycares_near returns geocode_quality');

select ok(
  (public.daycare_record((select operation_id from public.daycare_search('Rockwall') limit 1)) -> 'daycare')
    ?& array['geocode_source', 'geocode_quality'],
  'daycare_record header carries geocode_source + geocode_quality');

select * from finish();
rollback;
