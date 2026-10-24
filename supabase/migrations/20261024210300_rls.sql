-- Row-level security on every table. core/geo/ops/staging have no client policies and no
-- client grants, so anon and authenticated are denied twice over. The pipeline connects
-- as postgres (table owner) or service_role, which bypass RLS.

alter table core.daycares      enable row level security;
alter table core.inspections   enable row level security;
alter table core.violations    enable row level security;
alter table core.change_events enable row level security;
alter table geo.districts      enable row level security;
alter table ops.sync_runs      enable row level security;
alter table staging.operations enable row level security;
alter table staging.activities enable row level security;
alter table staging.violations enable row level security;
alter table app.watches        enable row level security;
alter table app.devices        enable row level security;
alter table app.notifications  enable row level security;

revoke all on all tables in schema core, geo, ops, staging, app from public, anon, authenticated;
grant all on all tables in schema core, geo, ops, staging, app to service_role;
grant usage, select on all sequences in schema core to service_role;

-- app.watches: a signed-in user sees, adds, and removes only their own watches.
grant select, insert, delete on app.watches to authenticated;

drop policy if exists watches_select_own on app.watches;
create policy watches_select_own on app.watches
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists watches_insert_own on app.watches;
create policy watches_insert_own on app.watches
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists watches_delete_own on app.watches;
create policy watches_delete_own on app.watches
  for delete to authenticated using (user_id = (select auth.uid()));

-- app.devices: own rows only. Re-pointing a token from another user goes through register_device().
grant select, insert, update, delete on app.devices to authenticated;

drop policy if exists devices_select_own on app.devices;
create policy devices_select_own on app.devices
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists devices_insert_own on app.devices;
create policy devices_insert_own on app.devices
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists devices_update_own on app.devices;
create policy devices_update_own on app.devices
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists devices_delete_own on app.devices;
create policy devices_delete_own on app.devices
  for delete to authenticated using (user_id = (select auth.uid()));

-- app.notifications: read-only to the owner; only the pipeline writes them.
grant select on app.notifications to authenticated;

drop policy if exists notifications_select_own on app.notifications;
create policy notifications_select_own on app.notifications
  for select to authenticated using (user_id = (select auth.uid()));
