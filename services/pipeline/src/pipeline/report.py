"""`python -m pipeline report`: the latest runs and the publish-lag study."""

from __future__ import annotations

from typing import Any

import psycopg
from psycopg.rows import dict_row

from pipeline.config import Settings


def report(settings: Settings, runs: int = 10) -> dict[str, Any]:
    with psycopg.connect(settings.require_db()) as conn, conn.cursor(row_factory=dict_row) as cur:
        recent = cur.execute(
            """select run_id, mode, started_at, finished_at, ok, error, join_rate, newest_source_date,
                      lag_median_days, lag_p90_days, duration_ms, stage_counts
               from ops.sync_runs order by started_at desc limit %s""", (runs,)).fetchall()
        lag = cur.execute(
            """select count(*) as findings,
                      percentile_cont(0.5) within group (order by lag) as median_days,
                      percentile_cont(0.9) within group (order by lag) as p90_days
               from (select (e.detected_at at time zone 'America/Chicago')::date - e.source_date as lag
                     from core.change_events e
                     where e.kind = 'new_violation' and not e.is_replay and not e.is_backfill
                       and e.source_date is not null) x""").fetchone()
        totals = cur.execute(
            """select (select count(*) from core.daycares) as daycares,
                      (select count(*) from core.inspections) as inspections,
                      (select count(*) from core.violations) as violations,
                      (select count(*) from core.change_events where not is_replay) as events,
                      (select count(*) from core.daycares where in_district and district_basis = 'point'
                         and operation_status = 'Y') as active_in_tx04_by_point""").fetchone()
    return {"totals": totals, "publish_lag_all_runs": lag, "runs": recent}
