-- Photos are shown only after a person has looked at each one and confirmed it shows that daycare's building.
-- core.daycare_photos gains creator (the Mapillary username, for the CC BY-SA credit), verified and verified_at.
-- daycare_record returns verified photos only, at most 2 (the carousel is 2 photos, then one overhead view),
-- and each item adds compass_angle and creator. Every earlier rule stays: licensed centers with an exact census
-- geocode only, never a home, nothing taken before the permit or more than 6 years ago. Same shape and grants.

alter table core.daycare_photos add column if not exists creator     text;
alter table core.daycare_photos add column if not exists verified    boolean not null default false;
alter table core.daycare_photos add column if not exists verified_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'core.daycare_photos'::regclass and conname = 'daycare_photos_verified_at_check') then
    alter table core.daycare_photos
      add constraint daycare_photos_verified_at_check check (not verified or verified_at is not null);
  end if;
end $$;

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
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'image_id',      ph.image_id,
               'captured_at',   ph.captured_at,
               'distance_m',    ph.distance_m,
               'compass_angle', ph.compass_angle,
               'creator',       ph.creator)
             order by ph.captured_at desc, ph.image_id)
        from (select p.image_id, p.captured_at, p.distance_m, p.compass_angle, p.creator
                from core.daycare_photos p
               where p.operation_id = d.operation_id
                 and p.verified
                 and d.operation_type = 'Licensed Center'
                 and d.geocode_source = 'census'
                 and d.geocode_quality = 'exact'
                 and (d.issuance_date is null or p.captured_at >= d.issuance_date)
                 and p.captured_at >= now() - interval '6 years'
               order by p.captured_at desc, p.image_id
               limit 2) ph), '[]'::jsonb),
    'official_url', 'https://childcare.hhs.texas.gov/Public/OperationDetails?operationId=' || d.operation_id,
    'last_checked_at', (select max(s.finished_at) from ops.sync_runs s where s.ok))
  from core.daycares d
  join core.daycare_rows r on r.operation_id = d.operation_id
  cross join w
  where d.operation_id = p_operation_id
$$;
