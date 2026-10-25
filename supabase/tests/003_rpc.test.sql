-- Client RPCs against real records (operation 1471156 Lionheart Childrens Academy at FBCVA,
-- Van Alstyne; 1366137 Princeton Montessori; both from supabase/seed.sql).
begin;
create extension if not exists pgtap with schema extensions;
-- Real records the asserts below name, so they hold on a fresh clone too (rolled back with the test).
\ir fixtures/real_rows.psql
select plan(47);

insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated');
insert into ops.sync_runs (mode, finished_at, ok, newest_source_date)
  values ('test', now() + interval '1 minute', true, '2026-10-23');
insert into core.change_events (operation_id, kind, ref_id, is_replay, source_date, after)
  select v.operation_id, 'new_violation', v.non_compliance_id::text, true, v.activity_date, '{"test": true}'
    from core.violations v where v.operation_id = 1471156
   order by v.activity_date desc nulls last limit 1;
create temp table ev on commit drop as select max(id) as id from core.change_events;
grant select on ev to authenticated;
-- Van Alstyne is inside TX-04; the seed alone carries no polygon, so set it here
-- (a no-op on a full pipeline load), then build the aggregates.
update core.daycares set in_district = true, district_basis = 'point'
 where operation_id = 1471156 and geom is not null;
select core.refresh_aggregates();

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

-- daycare_record
select ok(public.daycare_record(1471156) ?& array['daycare', 'findings', 'inspections', 'official_url', 'last_checked_at'],
  'daycare_record has every top-level key');
select is(public.daycare_record(1471156) -> 'daycare' ->> 'operation_id', '1471156', 'record is for the asked daycare');
select ok(public.daycare_record(1471156) -> 'daycare' ?& array[
    'operation_id', 'name', 'operation_type', 'address', 'city', 'zip', 'county', 'lat', 'lng', 'distance_km',
    'capacity', 'last_inspection_date', 'findings_24mo', 'in_district', 'district_basis', 'ages', 'hours', 'days',
    'subsidies', 'status', 'corrective_action', 'adverse_action', 'temporarily_closed', 'conditions_on_permit',
    'issuance_date'],
  'daycare header has every DaycareHeader key');
select ok(jsonb_array_length(public.daycare_record(1471156) -> 'findings') > 0, 'findings present');
select ok(public.daycare_record(1471156) -> 'findings' -> 0 ?& array[
    'non_compliance_id', 'activity_id', 'date', 'risk_level', 'category', 'plain', 'narrative', 'standard',
    'corrected_at_inspection', 'corrected_date', 'verified_date', 'via_investigation', 'technical_assistance'],
  'finding has every Finding key');
select ok(
  (select bool_and(a.d >= b.d) from (
     select (f ->> 'date')::date as d, row_number() over () as n
       from jsonb_array_elements(public.daycare_record(1471156) -> 'findings') f) a
   join (
     select (f ->> 'date')::date as d, row_number() over () as n
       from jsonb_array_elements(public.daycare_record(1471156) -> 'findings') f) b on b.n = a.n + 1),
  'findings are newest first');
select ok(jsonb_array_length(public.daycare_record(1471156) -> 'inspections') > 0, 'inspections present');
select ok(public.daycare_record(1471156) -> 'inspections' -> 0 ?& array['activity_id', 'date', 'type', 'self_report', 'violation_found'],
  'inspection has every key');
select is((select i -> 'self_report' from jsonb_array_elements(public.daycare_record(245451) -> 'inspections') i
            where (i ->> 'activity_id')::bigint = 904024902), 'true'::jsonb,
          'the daycare''s own report is marked self_report (245451, May 4 2026)');
select is((select i -> 'self_report' from jsonb_array_elements(public.daycare_record(245451) -> 'inspections') i
            where (i ->> 'activity_id')::bigint = 903884663), 'false'::jsonb,
          'a state inspection is not a self-report (null in the source becomes false)');
select is(public.daycare_record(1471156) ->> 'official_url',
  'https://childcare.hhs.texas.gov/Public/OperationDetails?operationId=1471156', 'official link');
select ok(public.daycare_record(1471156) ->> 'last_checked_at' is not null, 'last_checked_at comes from ops.sync_runs');
select is(public.daycare_record(-1), null, 'unknown daycare returns null');
select ok(
  (select bool_and(f ->> 'risk_level' in ('High', 'Medium High', 'Medium', 'Medium Low', 'Low'))
     from jsonb_array_elements(public.daycare_record(1471156) -> 'findings') f),
  'risk levels are the state''s exact words');

-- daycares_near (Van Alstyne)
select ok(exists (select 1 from public.daycares_near(33.42, -96.58, 10) where operation_id = 1471156), 'near finds the daycare');
select ok((select count(*) <= 150 from public.daycares_near(32.78, -96.80, 50)), 'near caps at 150 rows');
select is((select array_agg(k order by k) from jsonb_object_keys(
            (select to_jsonb(n) from public.daycares_near(33.42, -96.58, 10) n limit 1)) k),
          array['city', 'distance_km', 'district_basis', 'findings_24mo', 'geocode_quality', 'in_district',
                'last_inspection_date', 'lat', 'lng', 'name', 'operation_id', 'operation_type', 'visits_24mo'],
          'near returns only what the map and list draw');
select ok((select bool_and(lat is not null and lng is not null) from public.daycares_near(33.42, -96.58, 25)), 'near only returns mapped daycares');
select ok(
  (select bool_and(distance_km >= prev) from (
     select distance_km, lag(distance_km, 1, 0::float8) over (order by distance_km) as prev
       from public.daycares_near(33.42, -96.58, 25)) x),
  'near is nearest first');
select ok((select bool_and(distance_km <= 10.001) from public.daycares_near(33.42, -96.58, 10)), 'near respects km');
select ok(
  (select bool_and(operation_type = 'Listed Family Home')
     from public.daycares_near(33.0, -96.7, 30, '{"types": ["Listed Family Home"]}')),
  'near filters by type');
select ok(
  (select bool_and(in_district) from public.daycares_near(33.42, -96.58, 30, '{"in_district": true}')),
  'near filters by in_district');
select ok(
  (select count(*) = 0 from public.daycares_near(33.42, -96.58, 50)
    where operation_type in ('Child Placing Agency', 'General Residential Operation')),
  'near excludes out-of-scope operation types');

-- daycare_search
select ok(exists (select 1 from public.daycare_search('Lionheart') where operation_id = 1471156), 'search by name');
select ok(exists (select 1 from public.daycare_search('van alstyne') where operation_id = 1471156), 'search by city');
select ok(exists (select 1 from public.daycare_search('75495') where operation_id = 1471156), 'search by 5-digit ZIP');
select is((select count(*) from public.daycare_search('a')), 0::bigint, 'one-character search returns nothing');
select is((select count(*) from public.daycare_search('%%')), 0::bigint, 'LIKE wildcards are escaped');
select ok((select count(*) <= 50 from public.daycare_search('learning')), 'search caps at 50');
select ok((select bool_and(distance_km is null) from public.daycare_search('learning')), 'search has no distance');

-- area_compare, district_pulse, last_sync
select ok(public.area_compare(1471156) ?& array['county', 'operation_type', 'peer_count', 'window_months', 'this', 'median'],
  'area_compare keys');
select ok(public.area_compare(1471156) -> 'median' ?& array['inspections', 'inspections_with_findings', 'findings', 'findings_high'],
  'area_compare Stats keys');
select is(extract(isodow from (public.district_pulse() ->> 'week_start')::date)::int, 1, 'pulse defaults to a Monday');
select ok((public.district_pulse() ->> 'week_start')::date < date_trunc('week', now())::date, 'pulse default is a complete past week');
select is(public.district_pulse('2026-10-14') ->> 'week_start', '2026-10-12', 'pulse normalizes to the Monday');
select is(public.district_pulse('2026-10-14') ->> 'week_end', '2026-10-18', 'pulse week ends Sunday');
select is((public.last_sync() ->> 'ok')::boolean, true, 'last_sync returns the newest ok run');

-- watch / my_watches / unwatch
select lives_ok('select public.watch(1471156); select public.watch(1471156);', 'watch is idempotent');
select is((select count(*) from public.my_watches()), 1::bigint, 'my_watches lists the watch once');
select throws_ok('select public.watch(-1)', 'PT404', null, 'watch rejects an unknown daycare with a 404, not a 500');
select throws_ok($$ select public.register_device('ExponentPushToken[' || repeat('a', 300) || ']', 'ios') $$, '22023', null,
                 'register_device refuses a token longer than 200 characters');
select throws_ok($$ select public.register_device('ExponentPushToken[a b]', 'ios') $$, '22023', null,
                 'register_device refuses a token with a space inside');

-- alert_detail: A watches 1471156; B does not
select ok(public.alert_detail((select id from ev)) -> 'finding' ->> 'non_compliance_id' is not null, 'watcher sees the alert with its finding');
select lives_ok('select public.unwatch(1471156); select public.unwatch(1471156);', 'unwatch is idempotent');
select is((select count(*) from public.my_watches()), 0::bigint, 'watch removed');

-- register_device
select lives_ok($$ select public.register_device('ExponentPushToken[shared-phone]', 'ios') $$, 'A registers a device');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select public.register_device('ExponentPushToken[shared-phone]', 'android');
reset role;
select is((select user_id::text || '/' || platform from app.devices where expo_push_token = 'ExponentPushToken[shared-phone]'),
  '00000000-0000-4000-8000-00000000000b/android', 'same token from B re-points it to B');

select * from finish();
rollback;
