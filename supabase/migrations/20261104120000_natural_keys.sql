-- Match visits and findings on what the record says, not on the state's IDs.
--
-- Every time the state reloads the activity and violation datasets it issues new activity_id,
-- non_compliance_id and section_id values for the same records. Keyed on those IDs, the Oct 27
-- and Nov 4 2026 syncs each stored all ~157k visits and ~117k findings a second and third time
-- and logged ~117k old findings as new_violation events. The pipeline now matches rows on
-- natural_key (services/pipeline/src/pipeline/load.py builds it the same way as below) and keeps
-- the first IDs it saw, so findings stay linked to their visit and the app's IDs never move.
--
-- Visit key:   md5(operation, time, activity type) / ordinal within those three
-- Finding key: md5(operation, visit time, visit type, standard code, narrative) / ordinal
-- The ordinal only separates exact repeats, so a reload has the same key set as the load before it.

alter table core.inspections add column if not exists natural_key text;
alter table core.violations add column if not exists natural_key text;

-- Keys for rows stored before this column existed (and for seed rows), computed per load batch
-- (rows a run inserted share first_seen_at), exactly as the pipeline computes them for one pull.
create or replace function core.fill_natural_keys()
returns void
language sql
set search_path = ''
as $$
  update core.violations v set natural_key = k.natural_key
  from (
    select v.non_compliance_id,
           md5(row(v.operation_id, i.activity_at, i.activity_type, v.standard_code, v.narrative)::text) || '/' ||
           row_number() over (partition by v.first_seen_at, v.operation_id, i.activity_at, i.activity_type,
                                           v.standard_code, v.narrative
                              order by v.risk_level::text, v.corrected_at_inspection, v.corrected_date,
                                       v.verified_date, v.technical_assistance, v.non_compliance_id) as natural_key
    from core.violations v
    left join core.inspections i on i.activity_id = v.activity_id
    where v.natural_key is null
  ) k
  where v.non_compliance_id = k.non_compliance_id;

  update core.inspections i set natural_key = k.natural_key
  from (
    select activity_id,
           md5(row(operation_id, activity_at, activity_type)::text) || '/' ||
           row_number() over (partition by first_seen_at, operation_id, activity_at, activity_type
                              order by violation_found, self_report, activity_id) as natural_key
    from core.inspections
    where natural_key is null
  ) k
  where i.activity_id = k.activity_id;
$$;

revoke all on function core.fill_natural_keys() from public, anon, authenticated;

select core.fill_natural_keys();

-- Repair the reloads: keep the earliest copy of each record (its first_seen_at stays true),
-- point surviving findings at the surviving visit, drop the later copies, and drop the
-- new_violation events whose finding was only a re-issued copy. A no-op on a clean database.
delete from core.violations v
using (select non_compliance_id,
              row_number() over (partition by natural_key order by first_seen_at, non_compliance_id) as n
       from core.violations where natural_key is not null) d
where d.non_compliance_id = v.non_compliance_id and d.n > 1;

update core.violations v set activity_id = m.keep_id
from (select activity_id,
             first_value(activity_id) over (partition by natural_key order by first_seen_at, activity_id) as keep_id
      from core.inspections where natural_key is not null) m
where v.activity_id = m.activity_id and m.keep_id <> m.activity_id;

delete from core.inspections i
using (select activity_id,
              row_number() over (partition by natural_key order by first_seen_at, activity_id) as n
       from core.inspections where natural_key is not null) d
where d.activity_id = i.activity_id and d.n > 1;

delete from core.change_events e
where e.kind = 'new_violation' and not e.is_replay
  and not exists (select 1 from core.violations v where v.non_compliance_id::text = e.ref_id);

update core.change_events e set after = jsonb_set(e.after, '{activity_id}', to_jsonb(v.activity_id))
from core.violations v
where e.kind = 'new_violation' and v.non_compliance_id::text = e.ref_id
  and (e.after ->> 'activity_id') is distinct from v.activity_id::text;

create unique index if not exists inspections_natural_key_key on core.inspections (natural_key);
create unique index if not exists violations_natural_key_key on core.violations (natural_key);
