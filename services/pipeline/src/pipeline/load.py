"""Stages 3 to 6: stage, transform, diff.

Raw source rows land in staging.* (COPY, tagged with run_id) and the counts are checked
against the source. Validated rows then go through a typed temp table into core.* with
SQL upserts. Change events are detected in the same transaction by comparing the incoming
rows with what core already holds. core.change_events.dedupe_key makes every insert
idempotent, so re-running the same data creates 0 events.

Visits and findings are matched on what the record says (natural_key), not on the state's
IDs: every time the state reloads the activity and violation datasets it issues new
activity_id, non_compliance_id and section_id values for the same records. The IDs kept in
core are the first ones seen, so the links between findings and visits never move.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import psycopg
import structlog

from pipeline.classify import categorize, parse_standard, plain_summary
from pipeline.config import IN_SCOPE_TYPES, MIN_JOIN_RATE
from pipeline.models import Activity, Operation, Violation

log = structlog.get_logger()

Conn = psycopg.Connection[Any]

ACTIVITY_COLS = ("operation_id", "activity_id", "activity_date", "activity_type", "self_report",
                 "violation_found")
VIOLATION_COLS = ("operation_id", "activity_id", "section_id", "non_compliance_id",
                  "standard_number_description", "standard_risk_level", "corrected_at_inspection",
                  "corrected_date", "date_correction_verified", "narrative", "technical_assistance_given")


class JoinRateError(RuntimeError):
    pass


@dataclass
class LoadResult:
    counts: dict[str, int] = field(default_factory=dict)
    join_rate: float | None = None


def row_hash(raw: dict[str, Any]) -> str:
    """Stable hash of a source row as published (system fields excluded)."""
    body = {k: v for k, v in raw.items() if not k.startswith(":")}
    return hashlib.md5(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()


def geocode_key(op: Operation) -> str | None:
    """The address string the Census geocoder sees; a change means re-geocode."""
    if not op.address_line or not op.city:
        return None
    zip5 = (op.zipcode or "").split(" ")[0][:5]
    return f"{op.address_line}, {op.city}, TX {zip5}".strip()


def _copy(conn: Conn, sql: str, rows: Iterable[Sequence[Any]]) -> None:
    with conn.cursor() as cur, cur.copy(sql) as cp:
        for r in rows:
            cp.write_row(r)


# ---------------------------------------------------------------- stage 3

def stage(
    conn: Conn,
    run_id: UUID,
    ops_raw: list[dict[str, Any]],
    acts_raw: list[dict[str, str]],
    viols_raw: list[dict[str, str]],
) -> dict[str, int]:
    """COPY raw rows into staging.* for this run and check counts. Only the latest run is kept: the
    older rows are truncated (not deleted), so their space is freed when the run commits."""
    conn.execute("truncate staging.operations, staging.activities, staging.violations")
    _copy(conn, "copy staging.operations (run_id, raw) from stdin",
          ((run_id, json.dumps(r)) for r in ops_raw))
    _copy(conn, f"copy staging.activities (run_id, {', '.join(ACTIVITY_COLS)}) from stdin",
          ((run_id, *(r.get(c) or None for c in ACTIVITY_COLS)) for r in acts_raw))
    _copy(conn, f"copy staging.violations (run_id, {', '.join(VIOLATION_COLS)}) from stdin",
          ((run_id, *(r.get(c) or None for c in VIOLATION_COLS)) for r in viols_raw))
    counts: dict[str, int] = {}
    for t, src in (("operations", ops_raw), ("activities", acts_raw), ("violations", viols_raw)):
        row = conn.execute(f"select count(*) from staging.{t} where run_id = %s", (run_id,)).fetchone()
        n = int(row[0]) if row else 0
        if n != len(src):
            raise RuntimeError(f"staging.{t}: staged {n} rows but the source had {len(src)}")
        counts[f"staged_{t}"] = n
    return counts


# ---------------------------------------------------------------- stage 4 + 6: daycares

DAYCARE_TEMP = """
create temp table t_daycares (
  operation_id bigint primary key, operation_number text, name text, operation_type text,
  address text, address_line text, city text, county text, zip text, phone text,
  lat float8, lng float8, geocode_key text, capacity int, ages text[], hours text, days text[],
  programs text[], accepts_subsidies bool, issuance_type text, issuance_date date,
  operation_status text, conditions_on_permit bool, corrective_action bool, adverse_action bool,
  temporarily_closed bool, deficiency_high int, deficiency_medium_high int, deficiency_medium int,
  deficiency_medium_low int, deficiency_low int, total_inspections int, total_assessments int,
  total_reports int, total_self_reports int, source_updated_at timestamptz, row_hash text
) on commit drop
"""

# One event per changed field. ref_id is the source :updated_at, so the same flag flipping
# back on later is a new event while a re-run of the same data is not.
DAYCARE_EVENTS = """
insert into core.change_events (run_id, operation_id, kind, ref_id, before, after, source_date, is_backfill)
select %(run_id)s, t.operation_id, c.kind::public.change_kind,
       coalesce(t.source_updated_at::text, t.row_hash), c.before, c.after,
       (t.source_updated_at at time zone 'America/Chicago')::date, %(backfill)s
from t_daycares t
join core.daycares d using (operation_id)
cross join lateral (values
  ('status_change', d.operation_status is distinct from t.operation_status,
     jsonb_build_object('operation_status', d.operation_status),
     jsonb_build_object('operation_status', t.operation_status)),
  ('corrective_action', d.corrective_action is distinct from t.corrective_action,
     jsonb_build_object('corrective_action', d.corrective_action),
     jsonb_build_object('corrective_action', t.corrective_action)),
  ('adverse_action', d.adverse_action is distinct from t.adverse_action,
     jsonb_build_object('adverse_action', d.adverse_action),
     jsonb_build_object('adverse_action', t.adverse_action)),
  ('closure', d.temporarily_closed is distinct from t.temporarily_closed,
     jsonb_build_object('temporarily_closed', d.temporarily_closed),
     jsonb_build_object('temporarily_closed', t.temporarily_closed)),
  ('capacity_change', d.capacity is distinct from t.capacity,
     jsonb_build_object('capacity', d.capacity), jsonb_build_object('capacity', t.capacity)),
  ('permit_conditions', d.conditions_on_permit is distinct from t.conditions_on_permit,
     jsonb_build_object('conditions_on_permit', d.conditions_on_permit),
     jsonb_build_object('conditions_on_permit', t.conditions_on_permit))
) as c(kind, changed, before, after)
where c.changed
on conflict (dedupe_key) do nothing
"""

DAYCARE_UPSERT = """
insert into core.daycares as d (
  operation_id, operation_number, name, operation_type, address, address_line, city, county, zip,
  phone, geom, geocode_source, geocode_address, capacity, ages, hours, days, programs,
  accepts_subsidies, issuance_type, issuance_date, operation_status, conditions_on_permit,
  corrective_action, adverse_action, temporarily_closed, deficiency_high, deficiency_medium_high,
  deficiency_medium, deficiency_medium_low, deficiency_low, total_inspections, total_assessments,
  total_reports, total_self_reports, source_updated_at, row_hash)
select operation_id, operation_number, name, operation_type, address, address_line, city, county, zip,
  phone,
  case when lat is not null and lng is not null
       then extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography end,
  case when lat is not null and lng is not null then 'state' end,
  geocode_key, capacity, ages, hours, days, programs, accepts_subsidies, issuance_type, issuance_date,
  operation_status, conditions_on_permit, corrective_action, adverse_action, temporarily_closed,
  deficiency_high, deficiency_medium_high, deficiency_medium, deficiency_medium_low, deficiency_low,
  total_inspections, total_assessments, total_reports, total_self_reports, source_updated_at, row_hash
from t_daycares
on conflict (operation_id) do update set
  operation_number = excluded.operation_number, name = excluded.name,
  operation_type = excluded.operation_type, address = excluded.address,
  address_line = excluded.address_line, city = excluded.city, county = excluded.county,
  zip = excluded.zip, phone = excluded.phone,
  -- State coordinates win. A Census geocode survives only while the address is unchanged.
  geom = case
    when excluded.geocode_source = 'state' then excluded.geom
    when d.geocode_source = 'census' and d.geocode_address is not distinct from excluded.geocode_address
      then d.geom
  end,
  geocode_source = case
    when excluded.geocode_source = 'state' then 'state'
    when d.geocode_source = 'census' and d.geocode_address is not distinct from excluded.geocode_address
      then 'census'
  end,
  geocode_quality = case
    when excluded.geocode_source is null and d.geocode_source = 'census'
      and d.geocode_address is not distinct from excluded.geocode_address
      then d.geocode_quality
  end,
  geocode_attempted_at = case when d.geocode_address is not distinct from excluded.geocode_address
                              then d.geocode_attempted_at end,
  geocode_address = excluded.geocode_address,
  -- Membership is recomputed only for rows whose point moved (see ASSIGN_POINT).
  district_basis = case
    when excluded.geocode_source = 'state' and d.geom::extensions.geometry = excluded.geom::extensions.geometry
      then d.district_basis
    when excluded.geocode_source is null and d.geocode_source = 'census'
      and d.geocode_address is not distinct from excluded.geocode_address
      then d.district_basis
    -- still no point: keep the county fallback (ASSIGN_COUNTY re-checks it if the county changed)
    when excluded.geocode_source is null and d.geom is null then d.district_basis
  end,
  capacity = excluded.capacity, ages = excluded.ages, hours = excluded.hours, days = excluded.days,
  programs = excluded.programs, accepts_subsidies = excluded.accepts_subsidies,
  issuance_type = excluded.issuance_type, issuance_date = excluded.issuance_date,
  operation_status = excluded.operation_status, conditions_on_permit = excluded.conditions_on_permit,
  corrective_action = excluded.corrective_action, adverse_action = excluded.adverse_action,
  temporarily_closed = excluded.temporarily_closed, deficiency_high = excluded.deficiency_high,
  deficiency_medium_high = excluded.deficiency_medium_high, deficiency_medium = excluded.deficiency_medium,
  deficiency_medium_low = excluded.deficiency_medium_low, deficiency_low = excluded.deficiency_low,
  total_inspections = excluded.total_inspections, total_assessments = excluded.total_assessments,
  total_reports = excluded.total_reports, total_self_reports = excluded.total_self_reports,
  source_updated_at = excluded.source_updated_at, row_hash = excluded.row_hash,
  last_seen_at = now(),
  updated_at = case when d.row_hash is distinct from excluded.row_hash then now() else d.updated_at end
"""


def load_daycares(conn: Conn, run_id: UUID, ops: list[tuple[Operation, str]], backfill: bool) -> dict[str, int]:
    conn.execute(DAYCARE_TEMP)
    in_scope = [(o, h) for o, h in ops if o.operation_type in IN_SCOPE_TYPES]
    _copy(conn, "copy t_daycares from stdin", (
        (o.operation_id, o.operation_number, o.operation_name, o.operation_type, o.location_address,
         o.address_line, o.city, o.county, o.zipcode, o.phone_number, o.latitude, o.longitude,
         geocode_key(o), o.total_capacity, o.ages, o.hours_of_operation, o.days, o.programs,
         o.accepts_child_care_subsidies, o.type_of_issuance, o.issuance_date,
         "Y" if o.operation_status else "N", o.conditions_on_permit, o.corrective_action,
         o.adverse_action, o.temporarily_closed, o.deficiency_high, o.deficiency_medium_high,
         o.deficiency_medium, o.deficiency_medium_low, o.deficiency_low, o.total_inspections,
         o.total_assessments, o.total_reports, o.total_self_reports, o.updated_at, h)
        for o, h in in_scope
    ))
    with conn.cursor() as cur:
        cur.execute(DAYCARE_EVENTS, {"run_id": run_id, "backfill": backfill})
        events = cur.rowcount
        cur.execute(DAYCARE_UPSERT)
        upserted = cur.rowcount
    return {"daycares_in_scope": len(in_scope), "daycares_upserted": upserted, "events_daycare": events}


# ---------------------------------------------------------------- stage 4: inspections

# A visit is the operation, the time, and the kind of activity. The few visits that share all
# three are told apart by an ordinal, so the key set of a reload equals the key set before it.
INSPECTION_KEY = """
update t_inspections t set natural_key = k.natural_key
from (select activity_id,
             md5(row(operation_id, activity_at, activity_type)::text) || '/' ||
             row_number() over (partition by operation_id, activity_at, activity_type
                                order by violation_found, self_report, activity_id) as natural_key
      from t_inspections) k
where k.activity_id = t.activity_id
"""

# Only rows whose content changed are rewritten; touching every row nightly filled the disk.
INSPECTION_UPDATE = """
update core.inspections i
set violation_found = t.violation_found, self_report = t.self_report, row_hash = t.row_hash,
    last_seen_at = now(), updated_at = now()
from t_inspections t
where i.natural_key = t.natural_key
  and (i.violation_found, i.self_report) is distinct from (t.violation_found, t.self_report)
"""

INSPECTION_INSERT = """
insert into core.inspections (activity_id, operation_id, activity_at, activity_type, violation_found,
                              self_report, row_hash, natural_key)
select t.activity_id, t.operation_id, t.activity_at, t.activity_type, t.violation_found, t.self_report,
       t.row_hash, t.natural_key
from t_inspections t
where exists (select 1 from core.daycares d where d.operation_id = t.operation_id)
  and not exists (select 1 from core.inspections i where i.natural_key = t.natural_key)
on conflict do nothing
"""


def load_inspections(conn: Conn, acts: list[tuple[Activity, str]]) -> dict[str, int]:
    """Load this pull's visits. t_inspections stays for load_violations, which links findings through it."""
    conn.execute("""create temp table t_inspections (activity_id bigint primary key, operation_id bigint,
      activity_at timestamp, activity_type text, violation_found text, self_report bool, row_hash text,
      natural_key text) on commit drop""")
    _copy(conn, "copy t_inspections (activity_id, operation_id, activity_at, activity_type, violation_found, "
          "self_report, row_hash) from stdin", (
        (a.activity_id, a.operation_id, a.activity_date.replace(tzinfo=None), a.activity_type,
         a.violation_found, a.self_report, h)
        for a, h in acts
    ))
    conn.execute(INSPECTION_KEY)
    conn.execute("create index on t_inspections (natural_key)")
    with conn.cursor() as cur:
        cur.execute(INSPECTION_UPDATE)
        updated = cur.rowcount
        cur.execute(INSPECTION_INSERT)
        new = cur.rowcount
    return {"inspections_upserted": updated + new, "inspections_new": new, "inspections_updated": updated}


# ---------------------------------------------------------------- stage 4 + 6 + 7: violations

# Each finding is linked to its visit through this pull's activities, then to the visit row core
# already holds (stored_activity_id), so a reload never moves a finding to a new activity_id.
VIOLATION_LINK = """
update t_violations t
set activity_at = a.activity_at, activity_type = a.activity_type,
    stored_activity_id = i.activity_id, activity_date = i.activity_date
from t_inspections a
left join core.inspections i on i.natural_key = a.natural_key
where a.activity_id = t.activity_id
"""

# A finding is its visit, its standard, and the inspector's words; an ordinal separates exact repeats.
VIOLATION_KEY = """
update t_violations t set natural_key = k.natural_key
from (select non_compliance_id,
             md5(row(operation_id, activity_at, activity_type, standard_code, narrative)::text) || '/' ||
             row_number() over (partition by operation_id, activity_at, activity_type, standard_code, narrative
                                order by risk_level, corrected_at_inspection, corrected_date, verified_date,
                                         technical_assistance, non_compliance_id) as natural_key
      from t_violations) k
where k.non_compliance_id = t.non_compliance_id
"""

VIOLATION_UPDATE = """
update core.violations v
set standard_title = t.standard_title, risk_level = t.risk_level::public.risk_level,
    category = t.category::public.violation_category, plain = t.plain,
    corrected_at_inspection = t.corrected_at_inspection, corrected_date = t.corrected_date,
    verified_date = t.verified_date, technical_assistance = t.technical_assistance, row_hash = t.row_hash,
    last_seen_at = now(), updated_at = now()
from t_violations t
where v.natural_key = t.natural_key
  and (v.standard_title, v.risk_level::text, v.category::text, v.plain, v.corrected_at_inspection,
       v.corrected_date, v.verified_date, v.technical_assistance)
      is distinct from
      (t.standard_title, t.risk_level, t.category, t.plain, t.corrected_at_inspection,
       t.corrected_date, t.verified_date, t.technical_assistance)
"""

# New findings are inserted and, outside a backfill, each one becomes a new_violation event in the
# same statement, so an event always points at the row that was stored.
VIOLATION_INSERT = """
with ins as (
  insert into core.violations (non_compliance_id, activity_id, section_id, operation_id, activity_date,
    standard_code, standard_title, risk_level, category, plain, narrative, corrected_at_inspection,
    corrected_date, verified_date, technical_assistance, via_investigation, row_hash, natural_key)
  select t.non_compliance_id, coalesce(t.stored_activity_id, t.activity_id), t.section_id, t.operation_id,
    t.activity_date, t.standard_code, t.standard_title, t.risk_level::public.risk_level,
    t.category::public.violation_category, t.plain, t.narrative, t.corrected_at_inspection,
    t.corrected_date, t.verified_date, t.technical_assistance,
    coalesce(t.activity_type = 'REPORT', false), t.row_hash, t.natural_key
  from t_violations t
  where exists (select 1 from core.daycares d where d.operation_id = t.operation_id)
    and not exists (select 1 from core.violations v where v.natural_key = t.natural_key)
  on conflict do nothing
  returning non_compliance_id, activity_id, operation_id, activity_date, risk_level, category, standard_code
), ev as (
  insert into core.change_events (run_id, operation_id, kind, ref_id, before, after, source_date, is_backfill)
  select %(run_id)s, ins.operation_id, 'new_violation', ins.non_compliance_id::text, null,
         jsonb_build_object('activity_id', ins.activity_id, 'risk_level', ins.risk_level,
                            'category', ins.category, 'standard', ins.standard_code),
         ins.activity_date, false
  from ins
  where not %(backfill)s
  on conflict (dedupe_key) do nothing
  returning 1
)
select (select count(*) from ins), (select count(*) from ev)
"""

JOIN_RATE = """
select count(*) filter (where t.activity_at is not null)::float8 / nullif(count(*), 0), count(*)
from t_violations t
where exists (select 1 from core.daycares d where d.operation_id = t.operation_id)
"""


def violation_row(v: Violation, h: str) -> tuple[Any, ...]:
    code, title = parse_standard(v.standard_number_description)
    return (v.non_compliance_id, v.activity_id, v.section_id, v.operation_id, code or None, title,
            v.standard_risk_level, categorize(v.standard_number_description), plain_summary(v.narrative),
            v.narrative, v.corrected_at_inspection, v.corrected_date, v.date_correction_verified,
            v.technical_assistance_given, h)


def load_violations(
    conn: Conn, run_id: UUID, viols: list[tuple[Violation, str]], backfill: bool
) -> tuple[dict[str, int], float]:
    """Load this pull's findings. Needs t_inspections from load_inspections in the same transaction."""
    conn.execute("""create temp table t_violations (non_compliance_id bigint primary key,
      activity_id bigint, section_id bigint, operation_id bigint, standard_code text,
      standard_title text, risk_level text, category text, plain text, narrative text,
      corrected_at_inspection bool, corrected_date date, verified_date date,
      technical_assistance bool, row_hash text, activity_at timestamp, activity_type text,
      stored_activity_id bigint, activity_date date, natural_key text) on commit drop""")
    _copy(conn, "copy t_violations (non_compliance_id, activity_id, section_id, operation_id, standard_code, "
          "standard_title, risk_level, category, plain, narrative, corrected_at_inspection, corrected_date, "
          "verified_date, technical_assistance, row_hash) from stdin",
          (violation_row(v, h) for v, h in viols))
    conn.execute(VIOLATION_LINK)
    conn.execute(VIOLATION_KEY)
    conn.execute("create index on t_violations (natural_key)")
    row = conn.execute(JOIN_RATE).fetchone()
    rate = float(row[0]) if row and row[0] is not None else 1.0
    in_scope = int(row[1]) if row else 0
    if rate < MIN_JOIN_RATE:
        raise JoinRateError(f"join rate {rate:.4f} is below {MIN_JOIN_RATE} ({in_scope} in-scope violations)")
    with conn.cursor() as cur:
        cur.execute(VIOLATION_UPDATE)
        updated = cur.rowcount
        # A backfill loads history; five years of findings are not news, so no events.
        cur.execute(VIOLATION_INSERT, {"run_id": run_id, "backfill": backfill})
        got = cur.fetchone()
    new, events = (int(got[0]), int(got[1])) if got else (0, 0)
    counts = {"violations_in_scope": in_scope, "violations_upserted": updated + new, "violations_new": new,
              "violations_updated": updated, "events_new_violation": events}
    return counts, rate


# ---------------------------------------------------------------- stage 5: district

ASSIGN_POINT = """
update core.daycares d
set in_district = extensions.st_covers(g.geom::extensions.geometry, d.geom::extensions.geometry),
    district_basis = 'point'
from geo.districts g
where g.id = %(district)s and d.geom is not null
  and (%(full)s or d.district_basis is distinct from 'point')
"""

# No coordinates: fall back to the county, flagged. Only counties wholly inside the district
# count as in; a partial county stays out, because the app may claim "in TX-04" only on a point.
ASSIGN_COUNTY = """
update core.daycares d
set in_district = coalesce(d.county = any(%(whole)s), false), district_basis = 'county'
where d.geom is null
  and (d.district_basis is distinct from 'county'
       or d.in_district is distinct from coalesce(d.county = any(%(whole)s), false))
"""


def assign_district(conn: Conn, full: bool = False) -> dict[str, int]:
    """Point-in-polygon for rows whose point is new or moved (all rows when full), then the county fallback."""
    from pipeline import district

    loaded = conn.execute("select 1 from geo.districts where id = %s", (district.DISTRICT_ID,)).fetchone()
    if not loaded:
        district.upsert_district(conn)
    with conn.cursor() as cur:
        cur.execute(ASSIGN_POINT, {"district": district.DISTRICT_ID, "full": full})
        by_point = cur.rowcount
        cur.execute(ASSIGN_COUNTY, {"whole": sorted(district.TX04_COUNTIES_WHOLE)})
        by_county = cur.rowcount
    row = conn.execute("""select count(*) filter (where in_district and district_basis = 'point'),
                                 count(*) filter (where in_district and district_basis = 'county')
                          from core.daycares where operation_status = 'Y'""").fetchone()
    return {"district_changed_point": by_point, "district_changed_county": by_county,
            "in_district_point_active": int(row[0]) if row else 0,
            "in_district_county_active": int(row[1]) if row else 0}
