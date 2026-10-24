-- app: per-user data (RLS in the next migration)
create table if not exists app.watches (
  user_id       uuid not null references auth.users (id) on delete cascade,
  operation_id  bigint not null references core.daycares (operation_id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, operation_id)
);
create index if not exists watches_operation_idx on app.watches (operation_id);

create table if not exists app.devices (
  expo_push_token  text primary key check (expo_push_token <> ''),
  user_id          uuid not null references auth.users (id) on delete cascade,
  platform         public.device_platform not null,
  created_at       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  disabled_at      timestamptz                         -- set when Expo reports the token dead
);
create index if not exists devices_user_idx on app.devices (user_id);

create table if not exists app.notifications (
  user_id             uuid not null references auth.users (id) on delete cascade,
  event_id            bigint not null references core.change_events (id) on delete cascade,
  expo_push_token     text,
  is_replay           boolean not null default false,
  sent_at             timestamptz not null default now(),
  ticket_id           text,
  receipt_status      text,
  receipt_checked_at  timestamptz,
  error               text,
  primary key (user_id, event_id)
);
create index if not exists notifications_event_idx on app.notifications (event_id);

-- geo: district polygons (TX-04 from Census TIGER/Line CD119)
create table if not exists geo.districts (
  id         text primary key,                         -- 'TX-04'
  name       text not null,
  congress   smallint not null default 119,
  source     text not null,                            -- e.g. 'Census TIGER/Line 2024 CD119'
  geom       extensions.geography(MultiPolygon, 4326) not null,
  loaded_at  timestamptz not null default now()
);
create index if not exists districts_geom_gix on geo.districts using gist (geom);

-- ops: one row per pipeline run
create table if not exists ops.sync_runs (
  run_id              uuid primary key default gen_random_uuid(),
  mode                text not null default 'sync',
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  ok                  boolean,
  error               text,
  stage_counts        jsonb not null default '{}',
  join_rate           numeric check (join_rate between 0 and 1),
  newest_source_date  timestamptz,
  lag_median_days     numeric,
  lag_p90_days        numeric,
  duration_ms         integer
);
create index if not exists sync_runs_ok_finished_idx on ops.sync_runs (finished_at desc) where ok;

-- staging: raw landing tables, one batch per run_id. All text, named like the SODA fields.
create table if not exists staging.operations (
  run_id  uuid not null,
  raw     jsonb not null
);
create index if not exists staging_operations_run_idx on staging.operations (run_id);

create table if not exists staging.activities (
  run_id           uuid not null,
  operation_id     text,
  activity_id      text,
  activity_date    text,
  activity_type    text,
  self_report      text,
  violation_found  text
);
create index if not exists staging_activities_run_idx on staging.activities (run_id);

create table if not exists staging.violations (
  run_id                       uuid not null,
  operation_id                 text,
  activity_id                  text,
  section_id                   text,
  non_compliance_id            text,
  standard_number_description  text,
  standard_risk_level          text,
  corrected_at_inspection      text,
  corrected_date               text,
  date_correction_verified     text,
  narrative                    text,
  technical_assistance_given   text
);
create index if not exists staging_violations_run_idx on staging.violations (run_id);
