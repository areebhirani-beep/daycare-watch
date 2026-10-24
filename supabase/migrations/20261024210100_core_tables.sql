-- core: Texas HHSC Child Care Regulation data from data.texas.gov.
-- No foreign keys from inspections/violations to daycares: the source tables do not
-- join 100%, and the pipeline measures and enforces the join rate instead.

-- Operations (bc5r-88dy)
create table if not exists core.daycares (
  operation_id          bigint primary key,
  operation_number      text,
  name                  text not null,
  operation_type        text not null check (operation_type in (
                          'Licensed Center', 'Licensed Child-Care Home', 'Listed Family Home',
                          'Registered Child-Care Home', 'Child Placing Agency', 'General Residential Operation')),
  address               text,                         -- location_address as published
  address_line          text,
  city                  text,
  county                text,
  zip                   text,
  phone                 text,
  geom                  extensions.geography(Point, 4326),
  geocode_source        text check (geocode_source in ('state', 'census')),
  geocode_address       text,                         -- the exact string that was geocoded
  capacity              integer check (capacity >= 0),
  ages                  text[] not null default '{}',
  hours                 text,
  days                  text[] not null default '{}',
  programs              text[] not null default '{}',
  accepts_subsidies     boolean,
  issuance_type         text,
  issuance_date         date,
  operation_status      text check (operation_status in ('Y', 'N')),
  conditions_on_permit  boolean,
  corrective_action     boolean,
  adverse_action        boolean,
  temporarily_closed    boolean,
  deficiency_high         integer,
  deficiency_medium_high  integer,
  deficiency_medium       integer,
  deficiency_medium_low   integer,
  deficiency_low          integer,
  total_inspections     integer,
  total_assessments     integer,
  total_reports         integer,
  total_self_reports    integer,
  in_district           boolean not null default false,
  district_basis        text check (district_basis in ('point', 'county')),
  source_updated_at     timestamptz,                  -- SODA :updated_at
  row_hash              text,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- A point basis is only possible with a point.
  constraint daycares_point_basis_has_geom check (district_basis is distinct from 'point' or geom is not null)
);

create index if not exists daycares_geom_gix on core.daycares using gist (geom);
create index if not exists daycares_county_type_idx on core.daycares (county, operation_type);
create index if not exists daycares_zip_idx on core.daycares (zip);
create index if not exists daycares_in_district_idx on core.daycares (operation_id) where in_district;
create index if not exists daycares_name_trgm on core.daycares using gin (name extensions.gin_trgm_ops);
create index if not exists daycares_city_trgm on core.daycares using gin (city extensions.gin_trgm_ops);

-- Activities (m5q4-3y3d): every state visit
create table if not exists core.inspections (
  activity_id       bigint primary key,
  operation_id      bigint not null,
  activity_at       timestamp not null,               -- Texas local time as published (no zone in source)
  activity_date     date generated always as (activity_at::date) stored,
  activity_type     text not null check (activity_type in ('INSPECTION', 'REPORT', 'ASSESSMENT')),
  violation_found   text not null check (violation_found in ('Yes', 'No', 'Pending')),
  self_report       boolean,
  row_hash          text,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists inspections_operation_date_idx on core.inspections (operation_id, activity_date desc);
create index if not exists inspections_date_idx on core.inspections (activity_date);

-- Violations (tqgd-mf4x): every finding
create table if not exists core.violations (
  non_compliance_id        bigint primary key,
  activity_id              bigint not null,
  section_id               bigint,
  operation_id             bigint not null,
  activity_date            date,                      -- from the joined activity; null when unjoined
  standard_code            text,                      -- e.g. 746.1201(1); null if it could not be parsed
  standard_title           text not null,             -- the rest of standard_number_description
  risk_level               public.risk_level not null,
  category                 public.violation_category not null default 'other',
  plain                    text,                      -- plain-English summary; never adds facts
  narrative                text,                      -- the inspector's own words
  corrected_at_inspection  boolean not null default false,
  corrected_date           date,
  verified_date            date,                      -- date_correction_verified
  technical_assistance     boolean,
  via_investigation        boolean not null default false,  -- the activity was a REPORT
  fts                      tsvector generated always as (
                             to_tsvector('english'::regconfig,
                               coalesce(standard_title, '') || ' ' || coalesce(narrative, ''))
                           ) stored,
  row_hash                 text,
  first_seen_at            timestamptz not null default now(),
  last_seen_at             timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists violations_operation_date_idx on core.violations (operation_id, activity_date desc);
create index if not exists violations_activity_idx on core.violations (activity_id);
create index if not exists violations_date_idx on core.violations (activity_date);
create index if not exists violations_fts_gin on core.violations using gin (fts);

-- Change events: what the pipeline detected, and what Notify sends.
-- enum-to-text is only STABLE in Postgres (labels can be renamed); we never rename
-- labels, so this wrapper is safe to mark IMMUTABLE for the generated dedupe key.
create or replace function core.change_kind_text(k public.change_kind)
returns text
language sql
immutable
set search_path = ''
as $$ select k::text $$;

revoke all on function core.change_kind_text(public.change_kind) from public, anon, authenticated;

create table if not exists core.change_events (
  id            bigint generated always as identity primary key,
  run_id        uuid,
  operation_id  bigint not null,
  kind          public.change_kind not null,
  ref_id        text,                                 -- non_compliance_id for new_violation
  before        jsonb,
  after         jsonb,
  source_date   date,                                 -- the date the state record carries
  is_replay     boolean not null default false,       -- a labelled resend of a real past finding
  is_backfill   boolean not null default false,       -- detected during backfill; never notified
  detected_at   timestamptz not null default now(),
  -- Idempotency: the same detected change maps to the same key, so
  -- INSERT ... ON CONFLICT (dedupe_key) DO NOTHING makes re-runs create 0 events.
  -- Replays get a null key (nulls are distinct), so each replay is a new event.
  dedupe_key    text generated always as (
                  case when is_replay then null
                  else operation_id::text || ':' || core.change_kind_text(kind) || ':' || coalesce(ref_id, '')
                       || ':' || md5(coalesce(after::text, '')) end
                ) stored,
  constraint change_events_dedupe_key_key unique (dedupe_key),
  constraint change_events_new_violation_ref check (kind <> 'new_violation' or ref_id is not null)
);

create index if not exists change_events_operation_idx on core.change_events (operation_id, detected_at desc);
create index if not exists change_events_detected_idx on core.change_events (detected_at);
