-- Foundation: extensions, schemas, shared enum types, and helpers.
-- Every statement is idempotent so `supabase db reset` always succeeds from zero.

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists core;     -- public state data, written by the pipeline, read by clients only via RPC
create schema if not exists app;      -- per-user data, guarded by RLS
create schema if not exists geo;      -- district polygons
create schema if not exists ops;      -- sync run logs
create schema if not exists staging;  -- pipeline-only landing tables

-- Clients (anon, authenticated) never get direct access to core, geo, ops, or staging.
revoke all on schema core, geo, ops, staging from public, anon, authenticated;
revoke all on schema app from public, anon;
-- app is reachable by signed-in users only through RLS; it is not exposed by the REST API.
grant usage on schema app to authenticated;
grant usage on schema core, app, geo, ops, staging to service_role;

-- Enum types live in public so generated TypeScript types expose them as unions.
-- Risk levels are the exact strings the state publishes in standard_risk_level.
do $$ begin
  create type public.risk_level as enum ('High', 'Medium High', 'Medium', 'Medium Low', 'Low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.violation_category as enum (
    'supervision', 'background_checks', 'staff_ratio', 'safety_hazards', 'health_medication',
    'discipline', 'parent_communication', 'paperwork_admin', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.change_kind as enum (
    'new_violation', 'status_change', 'corrective_action', 'adverse_action',
    'closure', 'capacity_change', 'permit_conditions'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.device_platform as enum ('ios', 'android');
exception when duplicate_object then null; end $$;

-- "Today" in Texas (Central time), used for every rolling window.
create or replace function core.today()
returns date
language sql
stable
set search_path = ''
as $$ select (pg_catalog.now() at time zone 'America/Chicago')::date $$;

revoke all on function core.today() from public, anon, authenticated;
