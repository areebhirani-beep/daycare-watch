"""Stage 8: after core.refresh_aggregates(), the materialized views reconcile with core.* row for row."""
from __future__ import annotations

import os

import psycopg
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = [pytest.mark.db, pytest.mark.skipif(not DB, reason="DATABASE_URL not set")]

ACTIVE = """from core.daycares d where d.operation_type = any (core.in_scope_types())
            and d.operation_status is distinct from 'N'"""
IN_DISTRICT = """select operation_id from core.daycares where in_district and district_basis = 'point'
                 and operation_type = any (core.in_scope_types())"""
SINCE = "(core.today() - interval '24 months')::date"


def _one(conn: psycopg.Connection[tuple[object, ...]], sql: str) -> tuple[object, ...]:
    row = conn.execute(sql).fetchone()
    assert row is not None
    return row


def test_aggregates_reconcile_with_core() -> None:
    assert DB
    with psycopg.connect(DB) as conn:
        tx = conn.transaction()
        tx.__enter__()
        try:
            conn.execute("select core.refresh_aggregates()")

            stats = _one(conn, """select count(*), coalesce(sum(inspections), 0), coalesce(sum(findings), 0),
                                         coalesce(sum(findings_high), 0) from core.daycare_stats""")
            core = _one(conn, f"""select (select count(*) {ACTIVE}),
                (select count(*) from core.inspections i where i.activity_date >= {SINCE}
                   and i.operation_id in (select d.operation_id {ACTIVE})),
                (select count(*) from core.violations v where v.activity_date >= {SINCE}
                   and v.operation_id in (select d.operation_id {ACTIVE})),
                (select count(*) from core.violations v where v.activity_date >= {SINCE} and v.risk_level = 'High'
                   and v.operation_id in (select d.operation_id {ACTIVE}))""")
            assert stats == core

            peers = _one(conn, "select coalesce(sum(peer_count), 0) from core.area_medians")
            with_county = _one(conn, "select count(*) from core.daycare_stats where county is not null")
            assert peers == with_county

            pulse = _one(conn, """select coalesce(sum(visits), 0), coalesce(sum(findings), 0),
                                         coalesce(sum(findings_high), 0) from core.district_pulse_weekly""")
            core_pulse = _one(conn, f"""select
                (select count(*) from core.inspections where operation_id in ({IN_DISTRICT})),
                (select count(*) from core.violations where activity_date is not null
                   and operation_id in ({IN_DISTRICT})),
                (select count(*) from core.violations where activity_date is not null and risk_level = 'High'
                   and operation_id in ({IN_DISTRICT}))""")
            assert pulse == core_pulse

            mismatched = _one(conn, """select count(*) from core.district_pulse_weekly w
                where w.findings <> (select coalesce(sum((c->>'n')::int), 0)
                                       from jsonb_array_elements(w.by_category) c)""")
            assert mismatched == (0,)
        finally:
            tx.__exit__(psycopg.Rollback, psycopg.Rollback(), None)
