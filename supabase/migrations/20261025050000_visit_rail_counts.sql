-- Visit rail: each daycare_record.inspections[] entry gains per-visit counts.
--   findings_count = findings cited at that visit
--   high_count     = of those, risk level High
--   open_count     = of those, neither corrected at the inspection nor verified by the state
-- Return type is unchanged (jsonb), so create or replace keeps the existing grants.

create or replace function public.daycare_record(p_operation_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with w as (select (core.today() - interval '5 years')::date as since)
  select jsonb_build_object(
    'daycare', to_jsonb(r) || jsonb_build_object(
      'distance_km',          null,
      'ages',                 d.ages,
      'hours',                d.hours,
      'days',                 d.days,
      'subsidies',            d.accepts_subsidies,
      'status',               case d.operation_status when 'Y' then 'active' when 'N' then 'inactive' end,
      'corrective_action',    d.corrective_action,
      'adverse_action',       d.adverse_action,
      'temporarily_closed',   d.temporarily_closed,
      'conditions_on_permit', d.conditions_on_permit,
      'issuance_date',        d.issuance_date),
    'findings', coalesce((
      select jsonb_agg(core.finding_json(v) order by v.activity_date desc nulls last, v.non_compliance_id desc)
        from core.violations v
       where v.operation_id = d.operation_id
         and (v.activity_date is null or v.activity_date >= w.since)), '[]'::jsonb),
    'inspections', coalesce((
      select jsonb_agg(jsonb_build_object(
               'activity_id',     i.activity_id,
               'date',            i.activity_date,
               'type',            i.activity_type,
               'violation_found', i.violation_found,
               'findings_count',  c.findings_count,
               'high_count',      c.high_count,
               'open_count',      c.open_count)
             order by i.activity_at desc, i.activity_id desc)
        from core.inspections i
        cross join lateral (
          select count(*)::integer                                         as findings_count,
                 count(*) filter (where v.risk_level = 'High')::integer    as high_count,
                 count(*) filter (where not coalesce(v.corrected_at_inspection, false)
                                    and v.verified_date is null)::integer  as open_count
            from core.violations v
           where v.activity_id = i.activity_id) c
       where i.operation_id = d.operation_id
         and i.activity_date >= w.since), '[]'::jsonb),
    'official_url', 'https://childcare.hhs.texas.gov/Public/OperationDetails?operationId=' || d.operation_id,
    'last_checked_at', (select max(s.finished_at) from ops.sync_runs s where s.ok))
  from core.daycares d
  join core.daycare_rows r on r.operation_id = d.operation_id
  cross join w
  where d.operation_id = p_operation_id
$$;
