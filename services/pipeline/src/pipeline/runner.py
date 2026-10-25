"""One pipeline run, end to end, logged to ops.sync_runs.

    extract -> validate -> stage -> transform + diff + classify -> district -> aggregate -> notify -> log

The database work runs in one transaction: a failure anywhere leaves core.* untouched, and the
failure is still recorded in ops.sync_runs (written on its own connection).
"""

from __future__ import annotations

import time
import traceback
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import psycopg
import structlog
from psycopg.types.json import Jsonb

from pipeline import district, geocode, load
from pipeline.config import ACTIVITIES, VIOLATIONS, Settings, connect
from pipeline.models import Activity, Operation, Violation, validate_rows
from pipeline.soda import SodaClient

log = structlog.get_logger()

Conn = psycopg.Connection[Any]

FULL_RECONCILE_WEEKDAY = 6  # Sunday: re-pull every operation, not only those past the watermark


@dataclass(frozen=True)
class RunOptions:
    mode: str = "sync"  # sync | backfill
    full: bool = False
    since: str | None = None
    dry_run: bool = False
    notify: bool = True
    geocode: bool = True


LAG_SQL = """
select percentile_cont(0.5) within group (order by lag), percentile_cont(0.9) within group (order by lag),
       count(*)
from (
  select ((e.detected_at at time zone 'America/Chicago')::date - e.source_date) as lag
  from core.change_events e
  where e.run_id = %s and e.kind = 'new_violation' and not e.is_replay and e.source_date is not null
) x
"""

INSPECTION_LAG_SQL = """
select percentile_cont(0.5) within group (order by lag), percentile_cont(0.9) within group (order by lag),
       count(*)
from (
  select ((i.first_seen_at at time zone 'America/Chicago')::date - i.activity_date) as lag
  from core.inspections i where i.first_seen_at >= %s
) x
"""


def _watermark(conn: Conn) -> str | None:
    row = conn.execute("select max(source_updated_at) from core.daycares").fetchone()
    if not row or row[0] is None:
        return None
    ts: datetime = row[0]
    return ts.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]


def _call_if_exists(conn: Conn, fn: str) -> bool:
    schema, name = fn.split(".")
    row = conn.execute(
        "select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
        "where n.nspname = %s and p.proname = %s", (schema, name)).fetchone()
    if row:
        conn.execute(f"select {fn}()")
    return row is not None


def run(settings: Settings, opts: RunOptions, soda: SodaClient | None = None) -> UUID:
    db_url = settings.require_db()
    run_id = uuid4()
    started = time.monotonic()
    started_at = datetime.now(UTC)
    counts: dict[str, Any] = {}
    with connect(db_url, autocommit=True) as logconn:
        logconn.execute("insert into ops.sync_runs (run_id, mode, started_at) values (%s, %s, %s)",
                        (run_id, opts.mode + (" dry-run" if opts.dry_run else ""), started_at))
    bound = log.bind(run_id=str(run_id), mode=opts.mode)
    soda = soda or SodaClient(settings.soda_app_token)
    join_rate: float | None = None
    newest: datetime | None = None
    lag: tuple[Any, Any] = (None, None)
    try:
        with connect(db_url) as conn:
            backfill = opts.mode == "backfill"
            first_load = conn.execute("select not exists (select 1 from core.violations)").fetchone()
            if first_load and first_load[0] and not backfill:
                bound.warning("run.first_load_is_backfill")
                backfill = True
            since = None if (opts.full or backfill or datetime.now(UTC).weekday() == FULL_RECONCILE_WEEKDAY) \
                else (opts.since or _watermark(conn))

            # 1 extract
            t0 = time.monotonic()
            ops_raw = soda.operations(since=since)
            acts_raw = soda.download_csv(ACTIVITIES)
            viols_raw = soda.download_csv(VIOLATIONS)
            counts.update(extract_s=round(time.monotonic() - t0, 1), extract_operations=len(ops_raw),
                          extract_activities=len(acts_raw), extract_violations=len(viols_raw),
                          operations_since=since)

            # 2 validate (all or nothing)
            ops: list[Operation] = validate_rows("operations", ops_raw, Operation.from_source)
            acts: list[Activity] = validate_rows("activities", acts_raw, Activity.model_validate)
            viols: list[Violation] = validate_rows("violations", viols_raw, Violation.model_validate)
            newest = max(a.activity_date for a in acts) if acts else None

            # 3-6 stage, transform, diff, classify: one transaction
            with conn.transaction() as tx:
                counts.update(load.stage(conn, run_id, ops_raw, acts_raw, viols_raw))
                counts.update(load.load_daycares(
                    conn, run_id, [(o, load.row_hash(r)) for o, r in zip(ops, ops_raw, strict=True)], backfill))
                counts.update(load.load_inspections(
                    conn, [(a, load.row_hash(r)) for a, r in zip(acts, acts_raw, strict=True)]))
                vcounts, join_rate = load.load_violations(
                    conn, run_id, [(v, load.row_hash(r)) for v, r in zip(viols, viols_raw, strict=True)], backfill)
                counts.update(vcounts)
                # 5 district, 8 aggregate (platform functions, when present)
                if opts.geocode:
                    counts.update(geocode.geocode_pending(conn, priority_counties=district.TX04_COUNTIES,
                                                          cache_path=geocode.cache_path_from_env()))
                counts.update(load.assign_district(conn, full=opts.full or backfill))
                counts["aggregates_refreshed"] = _call_if_exists(conn, "core.refresh_aggregates")
                row = conn.execute(LAG_SQL, (run_id,)).fetchone()
                if row:
                    lag = (row[0], row[1])
                    counts["lag_sample_violations"] = int(row[2])
                irow = conn.execute(INSPECTION_LAG_SQL, (started_at,)).fetchone()
                if irow and not backfill:
                    counts.update(lag_inspections_median_days=irow[0], lag_inspections_p90_days=irow[1],
                                  lag_sample_inspections=int(irow[2]))
                if opts.dry_run:
                    tx_rollback(tx)
        ok, error = True, None
        if opts.notify and not opts.dry_run and not backfill:
            from pipeline.notify import Expo, notify

            with connect(db_url) as nconn:
                counts.update(notify(nconn, Expo(settings.expo_access_token)))
        if not opts.dry_run and not backfill:
            counts.update(_photos(db_url))
    except Exception as exc:
        ok, error = False, f"{type(exc).__name__}: {exc}"
        bound.error("run.failed", error=error, trace=traceback.format_exc(limit=5))
    duration_ms = int((time.monotonic() - started) * 1000)
    with connect(db_url, autocommit=True) as logconn:
        logconn.execute(
            """update ops.sync_runs set finished_at = now(), ok = %s, error = %s, stage_counts = %s,
               join_rate = %s, newest_source_date = %s, lag_median_days = %s, lag_p90_days = %s,
               duration_ms = %s where run_id = %s""",
            (ok, error, Jsonb(counts), join_rate, newest, lag[0], lag[1], duration_ms, run_id))
    bound.info("run.finished", ok=ok, duration_ms=duration_ms, join_rate=join_rate, **counts)
    if not ok:
        raise RuntimeError(error)
    return run_id


def _photos(db_url: str) -> dict[str, Any]:
    """Load the hand-checked photo and street-view lists. A problem here never fails the run."""
    from pipeline import photos

    try:
        with connect(db_url) as pconn:
            return photos.load_verified(pconn) | photos.load_street_view_checks(pconn)
    except Exception as exc:  # logged and reported in the run's counts
        log.warning("photos.failed", error=f"{type(exc).__name__}: {exc}")
        return {"photos_error": type(exc).__name__}


def tx_rollback(tx: psycopg.Transaction) -> None:
    """Roll back a dry run without treating it as a failure."""
    raise psycopg.Rollback(tx)
