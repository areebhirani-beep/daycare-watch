"""Whole runs against the local DB with the real fixtures served by a stub extract client.

Every run here is a dry run (rolled back) or a failing run; its ops.sync_runs row is removed after,
so the app's "Last checked with the state" never shows a test run.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from typing import Any

import psycopg
import pytest
import structlog

from pipeline import __main__ as cli
from pipeline.config import ACTIVITIES, Settings
from pipeline.runner import RunOptions, run
from tests.conftest import FIXTURES, read_csv

DB = os.environ.get("DATABASE_URL")
pytestmark = [pytest.mark.db, pytest.mark.skipif(not DB, reason="DATABASE_URL not set")]


class StubSoda:
    def __init__(self, broken: bool = False) -> None:
        self.broken = broken
        self.since: list[str | None] = []

    def operations(self, since: str | None = None) -> list[dict[str, Any]]:
        self.since.append(since)
        data: list[dict[str, Any]] = json.loads((FIXTURES / "operations.json").read_text())
        return data

    def download_csv(self, dataset: str) -> list[dict[str, str]]:
        rows = read_csv("activities.csv" if dataset == ACTIVITIES else "violations.csv")
        if self.broken and dataset != ACTIVITIES:
            rows[0] = {**rows[0], "standard_risk_level": "Severe"}
        return rows


@pytest.fixture(autouse=True)
def _reset_logging() -> Iterator[None]:
    yield
    structlog.reset_defaults()  # the CLI binds structlog to pytest's captured stderr


@pytest.fixture
def settings() -> Iterator[Settings]:
    assert DB
    with psycopg.connect(DB) as c:
        before = c.execute("select coalesce(max(started_at), 'epoch') from ops.sync_runs").fetchone()
    yield Settings(DB, None, None)
    with psycopg.connect(DB) as c:
        c.execute("delete from ops.sync_runs where started_at > %s", (before[0] if before else None,))


def _row(run_id: Any) -> tuple[Any, ...]:
    assert DB
    with psycopg.connect(DB) as c:
        row = c.execute("select ok, error, join_rate, stage_counts, mode from ops.sync_runs where run_id = %s",
                        (run_id,)).fetchone()
    assert row
    return tuple(row)


def test_dry_run_logs_ok_and_keeps_nothing(settings: Settings) -> None:
    assert DB
    with psycopg.connect(DB) as c:
        events = c.execute("select count(*) from core.change_events").fetchone()
    soda = StubSoda()
    run_id = run(settings, RunOptions(dry_run=True, notify=False, geocode=False), soda)  # type: ignore[arg-type]
    ok, error, join_rate, counts, mode = _row(run_id)
    assert ok is True and error is None and float(join_rate) == 1.0 and mode == "sync dry-run"
    assert counts["staged_violations"] == 446 and counts["events_new_violation"] == 0
    assert soda.since == [counts["operations_since"]]  # the watermark, or None on the Sunday full reconcile
    with psycopg.connect(DB) as c:
        assert c.execute("select count(*) from core.change_events").fetchone() == events
        assert c.execute("select count(*) from staging.violations where run_id = %s", (run_id,)).fetchone() == (0,)


def test_contract_break_fails_the_run_and_is_logged(settings: Settings) -> None:
    with pytest.raises(RuntimeError, match="ContractError"):
        run(settings, RunOptions(notify=False, geocode=False), StubSoda(broken=True))  # type: ignore[arg-type]
    assert DB
    with psycopg.connect(DB) as c:
        row = c.execute("select ok, error from ops.sync_runs order by started_at desc limit 1").fetchone()
    assert row and row[0] is False and "standard_risk_level" in row[1]


def test_report_command(settings: Settings, capsys: pytest.CaptureFixture[str]) -> None:
    assert cli.main(["report"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["totals"]["violations"] > 0 and "publish_lag_all_runs" in out


def test_replay_dry_run_command(settings: Settings, capsys: pytest.CaptureFixture[str]) -> None:
    nc = read_csv("violations.csv")[0]["non_compliance_id"]
    assert cli.main(["sync", "--replay", nc, "--dry-run"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["dry_run"] is True and out["non_compliance_id"] == int(nc)
