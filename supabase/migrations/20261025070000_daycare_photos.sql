-- Street-level photos (Mapillary, CC BY-SA) for the place page. The pipeline fills core.daycare_photos.
-- Only licensed centers with an exact street-address geocode ever return photos: home daycares are
-- private residences, and an approximate geocode could show the wrong building. The rule is enforced
-- in daycare_record itself, so a stray row for a home or an approximate point is never shown.

create table if not exists core.daycare_photos (
  operation_id  bigint      not null references core.daycares (operation_id) on delete cascade,
  image_id      text        not null,
  captured_at   timestamptz not null,
  distance_m    real        not null check (distance_m >= 0),
  compass_angle real                 check (compass_angle >= 0 and compass_angle < 360),
  primary key (operation_id, image_id)
);

create index if not exists daycare_photos_newest_idx on core.daycare_photos (operation_id, captured_at desc);

alter table core.daycare_photos enable row level security;
revoke all on core.daycare_photos from public, anon, authenticated;
grant all on core.daycare_photos to service_role;

-- daycare_record gains photos: [{image_id, captured_at, distance_m}], up to 3, newest first.
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
               'image_id',    ph.image_id,
               'captured_at', ph.captured_at,
               'distance_m',  ph.distance_m)
             order by ph.captured_at desc, ph.image_id)
        from (select p.image_id, p.captured_at, p.distance_m
                from core.daycare_photos p
               where p.operation_id = d.operation_id
                 and d.operation_type = 'Licensed Center'
                 and d.geocode_source = 'census'
                 and d.geocode_quality = 'exact'
               order by p.captured_at desc, p.image_id
               limit 3) ph), '[]'::jsonb),
    'official_url', 'https://childcare.hhs.texas.gov/Public/OperationDetails?operationId=' || d.operation_id,
    'last_checked_at', (select max(s.finished_at) from ops.sync_runs s where s.ok))
  from core.daycares d
  join core.daycare_rows r on r.operation_id = d.operation_id
  cross join w
  where d.operation_id = p_operation_id
$$;
