"""Stage/transform/diff against the local DB, on real fixtures, inside rolled-back transactions."""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from typing import Any

import psycopg
import pytest

from pipeline import load
from pipeline.models import Activity, Operation, Violation, validate_rows

DB = os.environ.get("DATABASE_URL")
pytestmark = [pytest.mark.db, pytest.mark.skipif(not DB, reason="DATABASE_URL not set")]


@pytest.fixture
def conn() -> Iterator[psycopg.Connection[Any]]:
    assert DB
    with psycopg.connect(DB) as c:
        tx = c.transaction()
        tx.__enter__()
        try:
            yield c
        finally:
            tx.__exit__(psycopg.Rollback, psycopg.Rollback(), None)


def _parsed(ops_raw: list[dict[str, Any]], acts_raw: list[dict[str, str]], viols_raw: list[dict[str, str]]) -> Any:
    ops: list[Operation] = validate_rows("o", ops_raw, Operation.from_source)
    acts: list[Activity] = validate_rows("a", acts_raw, Activity.model_validate)
    viols: list[Violation] = validate_rows("v", viols_raw, Violation.model_validate)
    return ([(o, load.row_hash(r)) for o, r in zip(ops, ops_raw, strict=True)],
            [(a, load.row_hash(r)) for a, r in zip(acts, acts_raw, strict=True)],
            [(v, load.row_hash(r)) for v, r in zip(viols, viols_raw, strict=True)])


def _wipe(conn: psycopg.Connection[Any], ids: list[int]) -> None:
    for t in ("core.violations", "core.inspections", "core.change_events", "app.watches", "core.daycares"):
        conn.execute(f"delete from {t} where operation_id = any(%s)", (ids,))


def _load(conn: psycopg.Connection[Any], run_id: uuid.UUID, parsed: Any, backfill: bool) -> dict[str, Any]:
    ops, acts, viols = parsed
    counts = load.load_daycares(conn, run_id, ops, backfill)
    conn.execute("drop table t_daycares")
    counts.update(load.load_inspections(conn, acts))
    conn.execute("drop table t_inspections")
    vc, rate = load.load_violations(conn, run_id, viols, backfill)
    conn.execute("drop table t_violations")
    return {**counts, **vc, "rate": rate}


def test_stage_counts_match_source(conn: psycopg.Connection[Any], ops_raw: list[dict[str, Any]],
                                   acts_raw: list[dict[str, str]], viols_raw: list[dict[str, str]]) -> None:
    counts = load.stage(conn, uuid.uuid4(), ops_raw, acts_raw, viols_raw)
    assert counts == {"staged_operations": 13, "staged_activities": 462, "staged_violations": 446}


def test_backfill_then_sync_is_idempotent_and_detects_changes(
    conn: psycopg.Connection[Any], ops_raw: list[dict[str, Any]],
    acts_raw: list[dict[str, str]], viols_raw: list[dict[str, str]],
) -> None:
    ids = [int(o["operation_id"]) for o in ops_raw]
    _wipe(conn, ids)
    parsed = _parsed(ops_raw, acts_raw, viols_raw)

    first = _load(conn, uuid.uuid4(), parsed, backfill=True)
    assert first["daycares_upserted"] == 13
    assert first["inspections_new"] == 462
    assert first["violations_upserted"] == 446
    assert first["rate"] == 1.0
    assert first["events_new_violation"] == 0  # history is not news

    again = _load(conn, uuid.uuid4(), parsed, backfill=False)
    assert again["events_new_violation"] == 0 and again["events_daycare"] == 0  # idempotent

    row = conn.execute("""select activity_date, via_investigation, category::text, plain, risk_level::text
                          from core.violations where operation_id = any(%s) and plain is not null
                          limit 1""", (ids,)).fetchone()
    assert row and row[0] is not None and row[2] and row[3]

    # A finding the state posts tonight: remove one real finding, reload, expect one event.
    nc = int(viols_raw[0]["non_compliance_id"])
    conn.execute("delete from core.violations where non_compliance_id = %s", (nc,))
    new = _load(conn, uuid.uuid4(), parsed, backfill=False)
    assert new["events_new_violation"] == 1
    ev = conn.execute("""select kind::text, ref_id, source_date, after ->> 'activity_id'
                         from core.change_events where ref_id = %s""", (str(nc),)).fetchone()
    assert ev and ev[0] == "new_violation" and ev[2] is not None
    assert ev[3] == viols_raw[0]["activity_id"]
    assert _load(conn, uuid.uuid4(), parsed, backfill=False)["events_new_violation"] == 0

    # The state flips two flags and capacity on one daycare: three events, once.
    op = dict(ops_raw[0])
    op.update(corrective_action="YES", temporarily_closed="YES", total_capacity="1", **{
        ":updated_at": "2026-10-25T09:00:00.000Z"})
    changed = _parsed([op], [], [])
    c1 = load.load_daycares(conn, uuid.uuid4(), changed[0], False)
    conn.execute("drop table t_daycares")
    assert c1["events_daycare"] == 3
    kinds = conn.execute("""select array_agg(kind::text order by kind::text) from core.change_events
                            where operation_id = %s and kind <> 'new_violation'""", (op["operation_id"],)).fetchone()
    assert kinds == (["capacity_change", "closure", "corrective_action"],)
    c2 = load.load_daycares(conn, uuid.uuid4(), changed[0], False)
    conn.execute("drop table t_daycares")
    assert c2["events_daycare"] == 0


def test_join_rate_below_threshold_fails(conn: psycopg.Connection[Any], ops_raw: list[dict[str, Any]],
                                        acts_raw: list[dict[str, str]], viols_raw: list[dict[str, str]]) -> None:
    ids = [int(o["operation_id"]) for o in ops_raw]
    _wipe(conn, ids)
    ops, _acts, viols = _parsed(ops_raw, acts_raw, viols_raw)
    load.load_daycares(conn, uuid.uuid4(), ops, True)
    with pytest.raises(load.JoinRateError):
        load.load_violations(conn, uuid.uuid4(), viols, True)  # no activities loaded -> 0% join


def test_district_assignment(conn: psycopg.Connection[Any]) -> None:
    counts = load.assign_district(conn)
    assert counts["in_district_point_active"] + counts["in_district_county_active"] > 0
    bad = conn.execute("""select count(*) from core.daycares where geom is null and district_basis = 'point'
                          or geom is not null and district_basis <> 'point'""").fetchone()
    assert bad == (0,)


def test_out_of_scope_types_are_skipped(conn: psycopg.Connection[Any], ops_raw: list[dict[str, Any]]) -> None:
    op = {**ops_raw[0], "operation_type": "General Residential Operation"}
    (parsed, _, _) = _parsed([op], [], [])
    assert load.load_daycares(conn, uuid.uuid4(), parsed, False)["daycares_in_scope"] == 0


def test_geocode_key() -> None:
    op = Operation.model_validate({"operation_id": 1, "operation_name": "x", "operation_type": "Licensed Center",
                                   "operation_status": "Y", "conditions_on_permit": "NO", "corrective_action": "NO",
                                   "adverse_action": "NO", "temporarily_closed": "NO", "address_line": "2111 E TUCK ST",
                                   "city": "SHERMAN", "zipcode": "75090 4112"})
    assert load.geocode_key(op) == "2111 E TUCK ST, SHERMAN, TX 75090"
    assert load.geocode_key(op.model_copy(update={"city": None})) is None
