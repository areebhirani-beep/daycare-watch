-- Client API (CONTRACT 4.1). Every RPC is in public, security definer, search_path = ''.
-- Reads are STABLE and granted to anon + authenticated. Writes and per-user reads need a
-- signed-in user (anonymous sign-in counts) and are granted to authenticated only.

-- Finding (CONTRACT 4.1) as jsonb.
create or replace function core.finding_json(v core.violations)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'non_compliance_id',       v.non_compliance_id,
    'activity_id',             v.activity_id,
    'date',                    v.activity_date,
    'risk_level',              v.risk_level,
    'category',                v.category,
    'plain',                   v.plain,
    'narrative',               v.narrative,
    'standard',                concat_ws(' - ', v.standard_code, v.standard_title),
    'corrected_at_inspection', v.corrected_at_inspection,
    'corrected_date',          v.corrected_date,
    'verified_date',           v.verified_date,
    'via_investigation',       v.via_investigation,
    'technical_assistance',    v.technical_assistance)
$$;

revoke all on function core.finding_json(core.violations) from public, anon, authenticated;

-- ---------------------------------------------------------------- reads

create or replace function public.daycares_near(
  lat float8,
  lng float8,
  km float8 default 10,
  filters jsonb default '{}'
)
returns table (
  operation_id bigint, name text, operation_type text, address text, city text, zip text,
  county text, lat float8, lng float8, distance_km float8, capacity integer,
  last_inspection_date date, findings_24mo integer, in_district boolean, district_basis text
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(
             extensions.st_makepoint(daycares_near.lng, daycares_near.lat), 4326
           )::extensions.geography as g
  ),
  f as (
    select
      coalesce(
        (select array_agg(t) from jsonb_array_elements_text(
           case when jsonb_typeof(daycares_near.filters -> 'types') = 'array'
                then daycares_near.filters -> 'types' end) as t),
        core.in_scope_types()) as types,
      case when jsonb_typeof(daycares_near.filters -> 'in_district') = 'boolean'
           then (daycares_near.filters ->> 'in_district')::boolean end as in_district,
      case when jsonb_typeof(daycares_near.filters -> 'subsidies') = 'boolean'
           then (daycares_near.filters ->> 'subsidies')::boolean end as subsidies,
      least(greatest(coalesce(daycares_near.km, 10), 0), 50) * 1000 as radius_m
  ),
  hits as (
    select d.operation_id, extensions.st_distance(d.geom, o.g) as dist_m
      from core.daycares d, origin o, f
     where d.geom is not null
       and extensions.st_dwithin(d.geom, o.g, f.radius_m)
       and d.operation_type = any (f.types)
       and d.operation_type = any (core.in_scope_types())
       and d.operation_status is distinct from 'N'
       and (f.in_district is null or d.in_district = f.in_district)
       and (f.subsidies is null or d.accepts_subsidies = f.subsidies)
     order by dist_m
     limit 200
  )
  select r.operation_id, r.name, r.operation_type, r.address, r.city, r.zip, r.county,
         r.lat, r.lng, h.dist_m / 1000.0, r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis
    from hits h
    join core.daycare_rows r on r.operation_id = h.operation_id
   order by h.dist_m
$$;

create or replace function public.daycare_search(q text)
returns table (
  operation_id bigint, name text, operation_type text, address text, city text, zip text,
  county text, lat float8, lng float8, distance_km float8, capacity integer,
  last_inspection_date date, findings_24mo integer, in_district boolean, district_basis text
)
language sql
stable
security definer
set search_path = ''
as $$
  with term as (
    select btrim(coalesce(daycare_search.q, '')) as raw,
           -- escape LIKE wildcards in user input
           replace(replace(replace(btrim(coalesce(daycare_search.q, '')), '\', '\\'), '%', '\%'), '_', '\_') as esc
  ),
  hits as (
    select d.operation_id,
           (d.zip like t.esc || '%') as zip_hit,
           (d.name ilike t.esc || '%') as prefix_hit,
           extensions.similarity(d.name, t.raw) as sim
      from core.daycares d, term t
     where length(t.raw) >= 2
       and d.operation_type = any (core.in_scope_types())
       and (   d.name ilike '%' || t.esc || '%'
            or d.city ilike t.esc
            or d.zip like t.esc || '%'
            or d.address ilike '%' || t.esc || '%')
     order by zip_hit desc, prefix_hit desc, sim desc, d.name
     limit 50
  )
  select r.operation_id, r.name, r.operation_type, r.address, r.city, r.zip, r.county,
         r.lat, r.lng, null::float8, r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis
    from hits h
    join core.daycare_rows r on r.operation_id = h.operation_id
   order by h.zip_hit desc, h.prefix_hit desc, h.sim desc, r.name
$$;

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
               'violation_found', i.violation_found)
             order by i.activity_at desc, i.activity_id desc)
        from core.inspections i
       where i.operation_id = d.operation_id
         and i.activity_date >= w.since), '[]'::jsonb),
    'official_url', 'https://childcare.hhs.texas.gov/Public/OperationDetails?operationId=' || d.operation_id,
    'last_checked_at', (select max(s.finished_at) from ops.sync_runs s where s.ok))
  from core.daycares d
  join core.daycare_rows r on r.operation_id = d.operation_id
  cross join w
  where d.operation_id = p_operation_id
$$;

create or replace function public.area_compare(p_operation_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'county',         s.county,
    'operation_type', s.operation_type,
    'peer_count',     m.peer_count,
    'window_months',  24,
    'this', jsonb_build_object(
      'inspections',               s.inspections,
      'inspections_with_findings', s.inspections_with_findings,
      'findings',                  s.findings,
      'findings_high',             s.findings_high),
    'median', jsonb_build_object(
      'inspections',               m.median_inspections,
      'inspections_with_findings', m.median_inspections_with_findings,
      'findings',                  m.median_findings,
      'findings_high',             m.median_findings_high))
  from core.daycare_stats s
  join core.area_medians m on m.county = s.county and m.operation_type = s.operation_type
  where s.operation_id = p_operation_id
$$;

create or replace function public.district_pulse(week_start date default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with wk as (
    select coalesce(
             date_trunc('week', district_pulse.week_start::timestamp)::date,
             (date_trunc('week', core.today()::timestamp) - interval '7 days')::date) as ws
  )
  select jsonb_build_object(
    'week_start',           wk.ws,
    'week_end',             wk.ws + 6,
    'visits',               coalesce(p.visits, 0),
    'visits_with_findings', coalesce(p.visits_with_findings, 0),
    'findings',             coalesce(p.findings, 0),
    'findings_high',        coalesce(p.findings_high, 0),
    'daycares_visited',     coalesce(p.daycares_visited, 0),
    'by_category',          coalesce(p.by_category, '[]'::jsonb))
  from wk
  left join core.district_pulse_weekly p on p.week_start = wk.ws
$$;

create or replace function public.last_sync()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
              'finished_at',        s.finished_at,
              'ok',                 s.ok,
              'newest_source_date', s.newest_source_date)
       from ops.sync_runs s
      where s.ok
      order by s.finished_at desc nulls last
      limit 1),
    jsonb_build_object('finished_at', null, 'ok', null, 'newest_source_date', null))
$$;

-- ---------------------------------------------------------------- per-user

create or replace function public.my_watches()
returns table (
  operation_id bigint, name text, operation_type text, address text, city text, zip text,
  county text, lat float8, lng float8, distance_km float8, capacity integer,
  last_inspection_date date, findings_24mo integer, in_district boolean, district_basis text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.operation_id, r.name, r.operation_type, r.address, r.city, r.zip, r.county,
         r.lat, r.lng, null::float8, r.capacity, r.last_inspection_date, r.findings_24mo,
         r.in_district, r.district_basis
    from app.watches w
    join core.daycare_rows r on r.operation_id = w.operation_id
   where w.user_id = (select auth.uid())
   order by w.created_at desc, r.operation_id
$$;

-- Visible to the caller if they watch the daycare now, or were sent a push for this event.
create or replace function public.alert_detail(p_event_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event_id',     e.id,
    'kind',         e.kind,
    'is_replay',    e.is_replay,
    'detected_at',  e.detected_at,
    'source_date',  e.source_date,
    'operation_id', e.operation_id,
    'daycare_name', d.name,
    'before',       e.before,
    'after',        e.after,
    'finding', case when e.kind = 'new_violation' and e.ref_id ~ '^[0-9]+$' then (
                 select core.finding_json(v) from core.violations v
                  where v.non_compliance_id = e.ref_id::bigint) end)
  from core.change_events e
  left join core.daycares d on d.operation_id = e.operation_id
  where e.id = p_event_id
    and (select auth.uid()) is not null
    and (   exists (select 1 from app.watches w
                     where w.user_id = (select auth.uid()) and w.operation_id = e.operation_id)
         or exists (select 1 from app.notifications n
                     where n.user_id = (select auth.uid()) and n.event_id = e.id))
$$;

create or replace function public.watch(p_operation_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;
  if not exists (select 1 from core.daycares d where d.operation_id = p_operation_id) then
    raise exception 'unknown operation_id %', p_operation_id using errcode = 'P0002';
  end if;
  if (select count(*) from app.watches w where w.user_id = v_uid) >= 100 then
    raise exception 'watch limit reached (100)' using errcode = '54000';
  end if;
  insert into app.watches (user_id, operation_id)
  values (v_uid, p_operation_id)
  on conflict do nothing;
end
$$;

create or replace function public.unwatch(p_operation_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;
  delete from app.watches w where w.user_id = v_uid and w.operation_id = p_operation_id;
end
$$;

-- Upsert on token: a reinstall or a new anonymous user on the same phone re-points the
-- token to the current user, so pushes follow the person holding the phone.
create or replace function public.register_device(p_expo_push_token text, p_platform text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;
  if p_expo_push_token is null or p_expo_push_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'not an Expo push token' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'platform must be ios or android' using errcode = '22023';
  end if;
  insert into app.devices (expo_push_token, user_id, platform, last_seen, disabled_at)
  values (p_expo_push_token, v_uid, p_platform::public.device_platform, now(), null)
  on conflict (expo_push_token) do update
     set user_id = excluded.user_id,
         platform = excluded.platform,
         last_seen = now(),
         disabled_at = null;
end
$$;

-- ---------------------------------------------------------------- grants

revoke all on function public.daycares_near(float8, float8, float8, jsonb) from public, service_role;
revoke all on function public.daycare_search(text)                        from public, service_role;
revoke all on function public.daycare_record(bigint)                      from public, service_role;
revoke all on function public.area_compare(bigint)                        from public, service_role;
revoke all on function public.district_pulse(date)                        from public, service_role;
revoke all on function public.last_sync()                                 from public, service_role;
revoke all on function public.my_watches()                                from public, anon, service_role;
revoke all on function public.alert_detail(bigint)                        from public, anon, service_role;
revoke all on function public.watch(bigint)                               from public, anon, service_role;
revoke all on function public.unwatch(bigint)                             from public, anon, service_role;
revoke all on function public.register_device(text, text)                 from public, anon, service_role;

grant execute on function public.daycares_near(float8, float8, float8, jsonb) to anon, authenticated;
grant execute on function public.daycare_search(text)                        to anon, authenticated;
grant execute on function public.daycare_record(bigint)                      to anon, authenticated;
grant execute on function public.area_compare(bigint)                        to anon, authenticated;
grant execute on function public.district_pulse(date)                        to anon, authenticated;
grant execute on function public.last_sync()                                 to anon, authenticated;
grant execute on function public.my_watches()                                to authenticated;
grant execute on function public.alert_detail(bigint)                        to authenticated;
grant execute on function public.watch(bigint)                               to authenticated;
grant execute on function public.unwatch(bigint)                             to authenticated;
grant execute on function public.register_device(text, text)                 to authenticated;
