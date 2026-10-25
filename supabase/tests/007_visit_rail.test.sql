-- Visit rail counts on daycare_record.inspections[] reconcile with the findings in the same record.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create temp table rec on commit drop as
select public.daycare_record(operation_id) as r
  from core.violations
 group by operation_id
 order by count(*) desc
 limit 1;

select ok(
  (select bool_and(e ?& array['findings_count', 'high_count', 'open_count'])
     from rec, jsonb_array_elements(r -> 'inspections') e),
  'every inspection carries findings_count, high_count, open_count');

select is(
  (select sum((e ->> 'findings_count')::int) from rec, jsonb_array_elements(r -> 'inspections') e)::bigint,
  (select count(*) from rec, jsonb_array_elements(r -> 'findings') f
    where (f ->> 'activity_id')::bigint in
          (select (e ->> 'activity_id')::bigint from rec, jsonb_array_elements(r -> 'inspections') e)),
  'findings_count adds up to the record''s findings at those visits');

select is(
  (select sum((e ->> 'high_count')::int) from rec, jsonb_array_elements(r -> 'inspections') e)::bigint,
  (select count(*) from rec, jsonb_array_elements(r -> 'findings') f
    where f ->> 'risk_level' = 'High'
      and (f ->> 'activity_id')::bigint in
          (select (e ->> 'activity_id')::bigint from rec, jsonb_array_elements(r -> 'inspections') e)),
  'high_count adds up to the record''s High findings');

select is(
  (select sum((e ->> 'open_count')::int) from rec, jsonb_array_elements(r -> 'inspections') e)::bigint,
  (select count(*) from rec, jsonb_array_elements(r -> 'findings') f
    where not (f ->> 'corrected_at_inspection')::boolean and f ->> 'verified_date' is null
      and (f ->> 'activity_id')::bigint in
          (select (e ->> 'activity_id')::bigint from rec, jsonb_array_elements(r -> 'inspections') e)),
  'open_count adds up to findings neither corrected at the inspection nor verified');

select ok(
  (select bool_and((e ->> 'high_count')::int <= (e ->> 'findings_count')::int
               and (e ->> 'open_count')::int <= (e ->> 'findings_count')::int
               and ((e ->> 'findings_count')::int = 0) = (e ->> 'violation_found' = 'No') or e ->> 'violation_found' = 'Pending')
     from rec, jsonb_array_elements(r -> 'inspections') e),
  'counts are within findings_count, and zero findings matches violation_found = No');

select * from finish();
rollback;
