-- Schema shape and security posture: RLS everywhere, no client access to core/geo/ops/staging,
-- and every client RPC is security definer with an empty search_path.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

select has_schema(s) from unnest(array['core', 'app', 'geo', 'ops', 'staging']) as s;

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('core', 'app', 'geo', 'ops', 'staging')
      and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0::bigint, 'every table in core/app/geo/ops/staging has RLS enabled');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')),
  0::bigint, 'public holds no tables or views (clients reach data only through RPCs)');

-- Clients have no schema access to core/geo/ops/staging.
select ok(not has_schema_privilege(r, s, 'usage'), format('%s has no usage on %s', r, s))
  from unnest(array['anon', 'authenticated']) as r,
       unnest(array['core', 'geo', 'ops', 'staging']) as s;

select ok(not has_schema_privilege('anon', 'app', 'usage'), 'anon has no usage on app');

-- PostgREST exposes only public and graphql_public, so core never reaches the REST API.
select ok(
  (select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'daycares_near', 'daycare_search', 'daycare_record', 'area_compare', 'district_pulse',
      'last_sync', 'my_watches', 'alert_detail', 'watch', 'unwatch', 'register_device')
      and not (p.prosecdef and p.proconfig @> array['search_path=""'])),
  'every client RPC is security definer with search_path = ''''');

select has_function('public', f, format('RPC %s exists', f))
  from unnest(array['daycares_near', 'daycare_search', 'daycare_record', 'area_compare',
                    'district_pulse', 'last_sync', 'my_watches', 'alert_detail', 'watch',
                    'unwatch', 'register_device']) as f;

-- Read RPCs: anon + authenticated. Per-user RPCs: authenticated only.
select ok(has_function_privilege('anon', 'public.daycare_record(bigint)', 'execute'), 'anon can read a record');
select ok(not has_function_privilege('anon', 'public.watch(bigint)', 'execute'), 'anon cannot watch');
select ok(not has_function_privilege('anon', 'public.register_device(text, text)', 'execute'), 'anon cannot register a device');
select ok(not has_function_privilege('anon', 'public.alert_detail(bigint)', 'execute'), 'anon cannot read alerts');
select ok(has_function_privilege('authenticated', 'public.watch(bigint)', 'execute'), 'authenticated can watch');
select ok(not has_function_privilege('anon', 'core.refresh_aggregates()', 'execute'), 'anon cannot refresh aggregates');

select * from finish();
rollback;
