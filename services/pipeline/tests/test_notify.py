"""Notify: alert copy, Expo batching, dead tokens, and (with a local DB) replay + dedupe."""

from __future__ import annotations

import json
import os
import uuid
from datetime import date
from typing import Any

import httpx
import psycopg
import pytest
import structlog

from pipeline.config import Settings
from pipeline.notify import (
    Expo,
    Group,
    check_receipts,
    display_name,
    fmt_date,
    pending_groups,
    receipts_now,
    send_groups,
)


def group(kind: str, before: Any = None, after: Any = None, n: int = 1, replay: bool = False) -> Group:
    return Group("u", 1206518, kind, "Tuck Street Early Education Center", list(range(1, n + 1)), replay,
                 date(2026, 8, 12), before, after, 904 if kind == "new_violation" else None, ["ExponentPushToken[a]"])


def test_new_findings_copy_singular_and_plural() -> None:
    assert group("new_violation").body() == (
        "The state posted 1 new finding from a visit on Aug 12, 2026. Tap to read what inspectors wrote.")
    assert "posted 3 new findings" in group("new_violation", n=3).body()


def test_replay_is_labelled() -> None:
    assert group("new_violation", replay=True).body().startswith("Replay of a real state record from Aug 12, 2026: ")


@pytest.mark.parametrize(
    ("kind", "before", "after", "text"),
    [
        ("status_change", {"operation_status": "Y"}, {"operation_status": "N"}, "permit as inactive"),
        ("status_change", {"operation_status": "N"}, {"operation_status": "Y"}, "active again"),
        ("corrective_action", {"corrective_action": False}, {"corrective_action": True}, "under corrective action"),
        ("corrective_action", {"corrective_action": True}, {"corrective_action": False}, "as ended"),
        ("adverse_action", {"adverse_action": False}, {"adverse_action": True}, "under adverse action"),
        ("closure", {"temporarily_closed": False}, {"temporarily_closed": True}, "temporarily closed."),
        ("closure", {"temporarily_closed": True}, {"temporarily_closed": False}, "no longer lists"),
        ("permit_conditions", {"conditions_on_permit": False}, {"conditions_on_permit": True}, "added conditions"),
        ("permit_conditions", {"conditions_on_permit": True}, {"conditions_on_permit": False}, "removed"),
        ("capacity_change", {"capacity": 153}, {"capacity": 120}, "from 153 to 120"),
    ],
)
def test_copy_per_kind(kind: str, before: Any, after: Any, text: str) -> None:
    body = group(kind, before, after).body()
    assert text in body
    for word in ("safe", "unsafe", "score", "grade", "rank", "danger"):
        assert word not in body.lower()


def test_message_payload_matches_contract() -> None:
    (m,) = group("new_violation").messages()
    assert m["title"] == "Tuck Street Early Education Center"
    assert m["data"] == {"event_id": 1, "operation_id": 1206518, "kind": "new_violation", "is_replay": False,
                         "activity_id": 904}


def test_display_name_and_date() -> None:
    assert display_name("KIDS R KIDS #12") == "Kids R Kids #12"
    assert display_name("Read Institute of Texas") == "Read Institute of Texas"
    assert fmt_date(date(2026, 10, 3)) == "Oct 3, 2026"


def test_expo_batches_of_100_and_token() -> None:
    sizes: list[int] = []
    auth: list[str] = []

    def handle(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content)
        sizes.append(len(body))
        auth.append(req.headers.get("authorization", ""))
        return httpx.Response(200, json={"data": [{"status": "ok", "id": f"t{i}"} for i in range(len(body))]})

    expo = Expo("secret", httpx.Client(transport=httpx.MockTransport(handle)))
    tickets = expo.send([{"to": f"ExponentPushToken[{i}]"} for i in range(250)])
    assert sizes == [100, 100, 50] and len(tickets) == 250
    assert set(auth) == {"Bearer secret"}


def test_receipts_batch() -> None:
    def handle(req: httpx.Request) -> httpx.Response:
        ids = json.loads(req.content)["ids"]
        return httpx.Response(200, json={"data": {i: {"status": "ok"} for i in ids}})

    expo = Expo(None, httpx.Client(transport=httpx.MockTransport(handle)))
    assert len(expo.receipts([f"t{i}" for i in range(1500)])) == 1500


# ---------------------------------------------------------------- local DB round trip

DB = os.environ.get("DATABASE_URL")


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_replay_round_trip_dedupes_and_prunes() -> None:
    sent: list[dict[str, Any]] = []

    def handle(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("getReceipts"):
            return httpx.Response(200, json={"data": {i: {"status": "ok"} for i in json.loads(req.content)["ids"]}})
        msgs = json.loads(req.content)
        sent.extend(msgs)
        return httpx.Response(200, json={"data": [
            {"status": "error", "message": "gone", "details": {"error": "DeviceNotRegistered"}}
            if m["to"].endswith("[dead]") else {"status": "ok", "id": f"t{i}"} for i, m in enumerate(msgs)]})

    expo = Expo(None, httpx.Client(transport=httpx.MockTransport(handle)))
    assert DB
    with psycopg.connect(DB) as conn:
        tx = conn.transaction()
        tx.__enter__()
        try:
            uid = uuid.uuid4()
            conn.execute("insert into auth.users (id, aud, role) values (%s, 'authenticated', 'authenticated')",
                         (uid,))
            # Any real loaded finding works; the seed and the full backfill both have some.
            nc = conn.execute("""select non_compliance_id, operation_id from core.violations
                                 order by activity_date desc, non_compliance_id limit 1""").fetchone()
            assert nc
            conn.execute("insert into app.watches (user_id, operation_id) values (%s, %s)", (uid, nc[1]))
            conn.execute("""insert into app.devices (expo_push_token, user_id, platform) values
                            ('ExponentPushToken[ok]', %s, 'ios'), ('ExponentPushToken[dead]', %s, 'android')""",
                         (uid, uid))
            (eid,) = conn.execute("""insert into core.change_events (operation_id, kind, ref_id, source_date,
                                       after, is_replay)
                                     select operation_id, 'new_violation', non_compliance_id::text, activity_date,
                                       jsonb_build_object('activity_id', activity_id), true
                                     from core.violations where non_compliance_id = %s returning id""",
                                  (nc[0],)).fetchone() or (None,)
            groups = pending_groups(conn, [eid])
            assert len(groups) == 1 and len(groups[0].tokens) == 2
            counts = send_groups(conn, expo, groups)
            assert counts["push_messages"] == 2 and counts["tokens_disabled"] == 1
            assert sent[0]["body"].startswith("Replay of a real state record from ")
            assert pending_groups(conn, [eid]) == []  # dedupe: (user, event) already claimed
            dead = conn.execute("""select disabled_at is not null from app.devices
                                   where expo_push_token = 'ExponentPushToken[dead]'""").fetchone()
            assert dead == (True,)
            # receipts: sent_at is this transaction's now(), so age the ticket past the cutoff
            conn.execute("update app.notifications set sent_at = sent_at - interval '1 second' where event_id = %s",
                         (eid,))
            assert check_receipts(conn, expo, min_age_minutes=0) == {"receipts_checked": 1, "receipts_errors": 0}
            status = conn.execute("select receipt_status from app.notifications where ticket_id is not null "
                                  "and event_id = %s", (eid,)).fetchone()
            assert status == ("delivered_to_provider",)
        finally:
            tx.__exit__(psycopg.Rollback, psycopg.Rollback(), None)


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_replay_dry_run_never_calls_expo_and_keeps_nothing() -> None:
    from pipeline.config import Settings
    from pipeline.notify import replay

    def handle(req: httpx.Request) -> httpx.Response:
        raise AssertionError("dry run called Expo")

    assert DB
    with psycopg.connect(DB) as conn:
        nc = conn.execute("select non_compliance_id from core.violations limit 1").fetchone()
        before = conn.execute("select count(*) from core.change_events").fetchone()
    assert nc and before
    expo = Expo(None, httpx.Client(transport=httpx.MockTransport(handle)))
    out = replay(Settings(DB, None, None), nc[0], expo, dry_run=True)
    assert out["dry_run"] is True and out["event_id"] is None
    with psycopg.connect(DB) as conn:
        assert conn.execute("select count(*) from core.change_events").fetchone() == before


def test_replay_unknown_finding_exits() -> None:
    from pipeline.config import Settings
    from pipeline.notify import replay

    if not DB:
        pytest.skip("DATABASE_URL not set")
    with pytest.raises(SystemExit, match="no finding"):
        replay(Settings(DB, None, None), -1, dry_run=True)


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_receipts_cli_reports_latest_sends(capsys: pytest.CaptureFixture[str]) -> None:
    from pipeline import __main__ as cli

    asked: list[str] = []

    def handle(req: httpx.Request) -> httpx.Response:
        asked.extend(json.loads(req.content)["ids"])
        return httpx.Response(200, json={"data": {}})

    expo = Expo(None, httpx.Client(transport=httpx.MockTransport(handle)))
    out = receipts_now(Settings(DB, None, None), min_age_minutes=100_000, expo=expo)
    assert out["receipts_checked"] == 0 and asked == [] and isinstance(out["latest"], list)
    assert all(r["to"].endswith("…") for r in out["latest"])
    try:
        cli.main(["receipts", "--min-age", "100000"])
    finally:
        structlog.reset_defaults()  # the CLI binds structlog to pytest's captured stderr
    assert '"receipts_checked": 0' in capsys.readouterr().out
