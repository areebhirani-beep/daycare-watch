-- street_view_checks: no client access, and daycare_record().daycare.street_view_checked is true only for a licensed
-- center with an exact census geocode whose checked view shows the building. Rows use real operation ids, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
-- Real records the asserts below name, so they hold on a fresh clone too (rolled back with the test).
\ir fixtures/real_rows.psql
select plan(8);

select ok(not has_table_privilege('anon', 'core.street_view_checks', 'select'), 'anon cannot read core.street_view_checks');
select ok(not has_table_privilege('authenticated', 'core.street_view_checks', 'select'), 'authenticated cannot read core.street_view_checks');
select ok((select relrowsecurity from pg_class where oid = 'core.street_view_checks'::regclass), 'RLS is enabled');

create temp table pick on commit drop as
select
  (select operation_id from core.daycares where operation_type = 'Licensed Center'
      and geocode_source = 'census' and geocode_quality = 'exact' order by operation_id limit 1) as center_yes,
  (select operation_id from core.daycares where operation_type = 'Licensed Center'
      and geocode_source = 'census' and geocode_quality = 'exact' order by operation_id offset 1 limit 1) as center_no,
  (select operation_id from core.daycares where operation_type = 'Licensed Center'
      and geocode_quality = 'non_exact' order by operation_id limit 1) as center_approx,
  (select operation_id from core.daycares where operation_type <> 'Licensed Center' order by operation_id limit 1) as home;
grant select on pick to anon;

delete from core.street_view_checks;
insert into core.street_view_checks (operation_id, shows_building, checked_at, note)
select center_yes, true, now(), 'qa: the building' from pick
union all select center_no, false, now(), 'qa: a field' from pick
union all select center_approx, true, now(), 'qa' from pick
union all select home, true, now(), 'qa' from pick;

set local role anon;
select is((public.daycare_record((select center_yes from pick)) -> 'daycare' -> 'street_view_checked'), 'true'::jsonb,
          'a checked view that shows the building: true');
select is((public.daycare_record((select center_no from pick)) -> 'daycare' -> 'street_view_checked'), 'false'::jsonb,
          'a checked view that shows something else: false');
select is((public.daycare_record((select center_approx from pick)) -> 'daycare' -> 'street_view_checked'), 'false'::jsonb,
          'an approximate geocode: false, even with a row');
select is((public.daycare_record((select home from pick)) -> 'daycare' -> 'street_view_checked'), 'false'::jsonb,
          'a home daycare: false, even with a row');
reset role;
delete from core.street_view_checks;
set local role anon;
select is((public.daycare_record((select center_yes from pick)) -> 'daycare' -> 'street_view_checked'), 'false'::jsonb,
          'no check on file: false');
reset role;

select * from finish();
rollback;
