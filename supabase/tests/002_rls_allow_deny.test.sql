-- Every allow and every deny for direct table access by clients.
-- Users A and B are throwaway test users; operation 1471156 and 1366137 are real daycares
-- from supabase/seed.sql (captured from data.texas.gov).
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated');

-- B's rows, created by the pipeline-equivalent owner
insert into app.watches (user_id, operation_id) values ('00000000-0000-4000-8000-00000000000b', 1366137);
insert into app.devices (expo_push_token, user_id, platform)
  values ('ExponentPushToken[test-b]', '00000000-0000-4000-8000-00000000000b', 'android');
insert into core.change_events (operation_id, kind, ref_id, is_replay, after)
  values (1366137, 'status_change', null, true, '{"test": true}');
insert into app.notifications (user_id, event_id)
  select '00000000-0000-4000-8000-00000000000b', max(id) from core.change_events;

-- ----------------------------------------------------------------- as user A
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

-- watches
select lives_ok($$ insert into app.watches (user_id, operation_id) values ('00000000-0000-4000-8000-00000000000a', 1471156) $$,
  'A can add own watch');
select throws_ok($$ insert into app.watches (user_id, operation_id) values ('00000000-0000-4000-8000-00000000000b', 1471156) $$,
  '42501', null, 'A cannot add a watch for B');
select is((select count(*) from app.watches), 1::bigint, 'A sees only own watches');
select is((select count(*) from app.watches where user_id = '00000000-0000-4000-8000-00000000000b'), 0::bigint, 'A cannot see B watches');
select throws_ok($$ update app.watches set operation_id = 1366137 $$, '42501', null, 'A cannot update watches (no grant)');
delete from app.watches where user_id = '00000000-0000-4000-8000-00000000000b';
select lives_ok($$ delete from app.watches where user_id = '00000000-0000-4000-8000-00000000000a' $$, 'A can delete own watch');
select is((select count(*) from app.watches), 0::bigint, 'A own watch is gone');

-- devices
select lives_ok($$ insert into app.devices (expo_push_token, user_id, platform) values ('ExponentPushToken[test-a]', '00000000-0000-4000-8000-00000000000a', 'ios') $$,
  'A can add own device');
select throws_ok($$ insert into app.devices (expo_push_token, user_id, platform) values ('ExponentPushToken[test-a2]', '00000000-0000-4000-8000-00000000000b', 'ios') $$,
  '42501', null, 'A cannot add a device for B');
select is((select count(*) from app.devices), 1::bigint, 'A sees only own devices');
update app.devices set platform = 'ios' where expo_push_token = 'ExponentPushToken[test-b]';
select lives_ok($$ update app.devices set last_seen = now() where expo_push_token = 'ExponentPushToken[test-a]' $$, 'A can update own device');
select throws_ok($$ update app.devices set user_id = '00000000-0000-4000-8000-00000000000b' where expo_push_token = 'ExponentPushToken[test-a]' $$,
  '42501', null, 'A cannot hand own device to B');
delete from app.devices where expo_push_token = 'ExponentPushToken[test-b]';

-- notifications
select is((select count(*) from app.notifications), 0::bigint, 'A cannot see B notifications');
select throws_ok($$ insert into app.notifications (user_id, event_id) select '00000000-0000-4000-8000-00000000000a', max(id) from core.change_events $$,
  '42501', null, 'A cannot write notifications');

-- core / geo / ops / staging: no direct access
select throws_ok(format('select 1 from %s limit 1', t), '42501', null, format('authenticated denied on %s', t))
  from unnest(array['core.daycares', 'core.inspections', 'core.violations', 'core.change_events',
                    'core.daycare_rows', 'core.area_medians', 'geo.districts', 'ops.sync_runs',
                    'staging.violations']) as t;

-- ----------------------------------------------------------------- as user B
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}';

select is((select count(*) from app.watches), 1::bigint, 'B watch survived A delete attempt');
select is((select platform::text from app.devices where expo_push_token = 'ExponentPushToken[test-b]'), 'android', 'B device untouched by A update');
select is((select count(*) from app.notifications), 1::bigint, 'B sees own notification');

-- ----------------------------------------------------------------- as anon
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok('select 1 from app.watches', '42501', null, 'anon denied on app.watches');
select throws_ok('select 1 from core.daycares', '42501', null, 'anon denied on core.daycares');

reset role;
select * from finish();
rollback;
