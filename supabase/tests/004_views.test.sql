-- Materialized views: concurrent-refresh ready, and their totals reconcile with core.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select lives_ok('select core.refresh_aggregates()', 'refresh_aggregates runs (concurrent refresh)');

select ok(exists (select 1 from pg_indexes where schemaname = 'core' and indexname = i and indexdef like 'CREATE UNIQUE%'),
          format('%s is a unique index', i))
  from unnest(array['daycare_stats_pk', 'area_medians_pk', 'district_pulse_weekly_pk']) as i;

select is(
  (select count(*) from core.daycare_stats),
  (select count(*) from core.daycares
    where operation_type = any (core.in_scope_types()) and operation_status is distinct from 'N'),
  'daycare_stats has one row per active in-scope daycare');

select is(
  (select coalesce(sum(peer_count), 0)::bigint from core.area_medians),
  (select count(*) from core.daycare_stats where county is not null),
  'area_medians peer counts add up to daycare_stats');

select is(
  (select coalesce(sum(findings), 0)::bigint from core.district_pulse_weekly),
  (select count(*) from core.violations v
     join core.daycares d using (operation_id)
    where d.in_district and d.district_basis = 'point'
      and d.operation_type = any (core.in_scope_types())
      and v.activity_date is not null),
  'district pulse findings reconcile with core.violations');

select is(
  (select coalesce(sum(visits), 0)::bigint from core.district_pulse_weekly),
  (select count(*) from core.inspections i
     join core.daycares d using (operation_id)
    where d.in_district and d.district_basis = 'point'
      and d.operation_type = any (core.in_scope_types())),
  'district pulse visits reconcile with core.inspections');

select is(
  (select coalesce(sum(c.n), 0)::bigint
     from core.district_pulse_weekly p, jsonb_to_recordset(p.by_category) as c(category text, n int)),
  (select coalesce(sum(findings), 0)::bigint from core.district_pulse_weekly),
  'pulse category counts add up to findings');

select * from finish();
rollback;
