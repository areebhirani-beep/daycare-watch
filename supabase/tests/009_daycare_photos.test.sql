-- daycare_photos: no client access, and daycare_record shows only photos a person verified, only for licensed
-- centers with an exact geocode, at most 2, newest first. Rows below use real operation ids and are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
-- Real records the asserts below name, so they hold on a fresh clone too (rolled back with the test).
\ir fixtures/real_rows.psql
select plan(12);

select ok(not has_table_privilege('anon', 'core.daycare_photos', 'select'), 'anon cannot read core.daycare_photos');
select ok(not has_table_privilege('authenticated', 'core.daycare_photos', 'select'), 'authenticated cannot read core.daycare_photos');
select ok((select relrowsecurity from pg_class where oid = 'core.daycare_photos'::regclass), 'RLS is enabled');

create temp table pick on commit drop as
select
  (select operation_id from core.daycares where operation_type = 'Licensed Center'
      and geocode_source = 'census' and geocode_quality = 'exact' order by operation_id limit 1) as center_exact,
  (select operation_id from core.daycares where operation_type = 'Licensed Center'
      and geocode_quality = 'non_exact' order by operation_id limit 1) as center_approx,
  (select operation_id from core.daycares where operation_type <> 'Licensed Center'
      and geocode_quality = 'exact' order by operation_id limit 1) as home_exact;
grant select on pick to anon;

delete from core.daycare_photos where operation_id in (select center_exact from pick union select center_approx from pick union select home_exact from pick);

-- Every row is verified except qa-unverified, the newest; the home and approximate rows are verified too, so
-- only the geocode and home rules can hide them.
insert into core.daycare_photos (operation_id, image_id, captured_at, distance_m, compass_angle, creator, verified, verified_at)
select p.center_exact, 'qa-' || n, timestamptz '2026-01-01' + n * interval '30 days', 10 + n, 90, 'qa-creator', true, now()
  from pick p, generate_series(1, 4) n
union all
select p.center_exact, 'qa-unverified', timestamptz '2026-09-01', 9, 90, 'qa-creator', false, null from pick p
union all
select p.center_approx, 'qa-approx', now(), 12, 90, 'qa-creator', true, now() from pick p
union all
select p.home_exact, 'qa-home', now(), 8, 90, 'qa-creator', true, now() from pick p;

set local role anon;

select is(jsonb_array_length(public.daycare_record((select center_exact from pick)) -> 'photos'), 2,
          'an exact-geocoded licensed center returns at most 2 photos');
select ok(not (public.daycare_record((select center_exact from pick)) -> 'photos') @> '[{"image_id": "qa-unverified"}]',
          'a photo no one verified is never returned, even when it is the newest');
select is(public.daycare_record((select center_exact from pick)) -> 'photos' -> 0 ->> 'image_id', 'qa-4',
          'newest photo first');
select is((select array_agg(k order by k) from jsonb_object_keys(public.daycare_record((select center_exact from pick)) -> 'photos' -> 0) k),
          array['captured_at', 'compass_angle', 'creator', 'distance_m', 'image_id'],
          'photo shape is {image_id, captured_at, distance_m, compass_angle, creator}');
select is(public.daycare_record((select center_exact from pick)) -> 'photos' -> 0 ->> 'creator', 'qa-creator',
          'the photo carries its creator for the CC BY-SA credit');
select is(public.daycare_record((select home_exact from pick)) -> 'photos', '[]'::jsonb,
          'a home daycare never returns photos, even when a row exists');
select is(public.daycare_record((select center_approx from pick)) -> 'photos', '[]'::jsonb,
          'an approximate geocode never returns photos, even when a row exists');

reset role;

select throws_ok(
  $$insert into core.daycare_photos (operation_id, image_id, captured_at, distance_m) values (-1, 'x', now(), 1)$$,
  '23503', null, 'photos must belong to a known daycare');
select throws_ok(
  $$insert into core.daycare_photos (operation_id, image_id, captured_at, distance_m, verified)
    select center_exact, 'qa-no-date', now(), 1, true from pick$$,
  '23514', null, 'a verified photo must record when it was verified');

select * from finish();
rollback;
