"""Stage 9, notify: change events x watchers -> Expo Push API.

- Only events detected after the parent started watching, never backfill events.
- New findings from one visit become one push per parent ("2 new findings from a visit on ...").
- app.notifications (user_id, event_id) is claimed before sending, so a re-run never double-sends.
- Tickets are checked for errors now; receipts are checked on a later run. Tokens Expo reports
  as DeviceNotRegistered are disabled.
- Replay resends a real past finding as a new, clearly labelled event. The finding is untouched.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import httpx
import psycopg
import structlog
from psycopg.rows import dict_row

from pipeline.config import Settings, connect

log = structlog.get_logger()

Conn = psycopg.Connection[Any]

EXPO_SEND = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS = "https://exp.host/--/api/v2/push/getReceipts"
BATCH = 100
RECEIPT_BATCH = 1000

# Alert copy, agreed with mobile (CONTRACT 4.2). Plain statements of what the state posted.
NEW_FINDINGS = "The state posted {n} new {noun} from a visit on {date}. Tap to read what inspectors wrote."
FLAG_COPY: dict[str, tuple[str, str]] = {
    "corrective_action": ("The state placed this daycare under corrective action.",
                          "The state lists corrective action at this daycare as ended."),
    "adverse_action": ("The state placed this daycare under adverse action.",
                       "The state lists adverse action at this daycare as ended."),
    "closure": ("The state lists this daycare as temporarily closed.",
                "The state no longer lists this daycare as temporarily closed."),
    "permit_conditions": ("The state added conditions to this daycare's permit.",
                          "The state lists the conditions on this daycare's permit as removed."),
}
STATUS_COPY = {"N": "The state now lists this daycare's permit as inactive.",
               "Y": "The state now lists this daycare's permit as active again."}
CAPACITY = "The state changed licensed capacity from {before} to {after}."
REPLAY_PREFIX = "Replay of a real state record from {date}: "


def fmt_date(d: date) -> str:
    return f"{d:%b} {d.day}, {d.year}"


def display_name(name: str) -> str:
    """The name as the state lists it, with runs of spaces collapsed for display, title-cased only when
    the source is ALL CAPS. The stored name stays verbatim."""
    name = " ".join(name.split())
    return name.title() if name.isupper() else name


@dataclass
class Group:
    """One push to one parent: a single event, or all new findings from one visit."""

    user_id: Any
    operation_id: int
    kind: str
    name: str
    event_ids: list[int]
    is_replay: bool
    source_date: date | None
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    activity_id: int | None
    tokens: list[str] = field(default_factory=list)

    def body(self) -> str:
        text = self._text()
        if self.is_replay and self.source_date:
            text = REPLAY_PREFIX.format(date=fmt_date(self.source_date)) + text
        return text

    def _text(self) -> str:
        after = self.after or {}
        before = self.before or {}
        if self.kind == "new_violation":
            n = len(self.event_ids)
            when = fmt_date(self.source_date) if self.source_date else "a recent date"
            return NEW_FINDINGS.format(n=n, noun="finding" if n == 1 else "findings", date=when)
        if self.kind == "status_change":
            return STATUS_COPY[str(after.get("operation_status"))]
        if self.kind == "capacity_change":
            return CAPACITY.format(before=before.get("capacity"), after=after.get("capacity"))
        on, off = FLAG_COPY[self.kind]
        return on if next(iter(after.values()), False) else off

    def messages(self) -> list[dict[str, Any]]:
        data = {"event_id": self.event_ids[0], "operation_id": self.operation_id, "kind": self.kind,
                "is_replay": self.is_replay}
        if self.activity_id is not None:
            data["activity_id"] = self.activity_id
        return [{"to": t, "title": display_name(self.name), "body": self.body(), "data": data,
                 "sound": "default", "priority": "high", "channelId": "default"} for t in self.tokens]


PENDING_SQL = """
select w.user_id, e.id as event_id, e.operation_id, e.kind::text as kind, e.is_replay, e.source_date,
       e.before, e.after, (e.after ->> 'activity_id')::bigint as activity_id, d.name,
       array_agg(dv.expo_push_token order by dv.last_seen desc) as tokens
from core.change_events e
join app.watches w on w.operation_id = e.operation_id and w.created_at <= e.detected_at
join app.devices dv on dv.user_id = w.user_id and dv.disabled_at is null
join core.daycares d on d.operation_id = e.operation_id
where not e.is_backfill
  and (%(event_ids)s::bigint[] is null or e.id = any(%(event_ids)s::bigint[]))
  and not exists (select 1 from app.notifications n where n.user_id = w.user_id and n.event_id = e.id)
group by w.user_id, e.id, d.name
order by e.id
"""


def pending_groups(conn: Conn, event_ids: Sequence[int] | None = None) -> list[Group]:
    with conn.cursor(row_factory=dict_row) as cur:
        rows = cur.execute(PENDING_SQL, {"event_ids": list(event_ids) if event_ids else None}).fetchall()
    groups: dict[tuple[Any, ...], Group] = {}
    for r in rows:
        key: tuple[Any, ...]
        if r["kind"] == "new_violation":
            key = (r["user_id"], r["operation_id"], "visit", r["activity_id"], r["is_replay"])
        else:
            key = (r["user_id"], r["event_id"])
        g = groups.get(key)
        if g is None:
            groups[key] = Group(r["user_id"], r["operation_id"], r["kind"], r["name"], [r["event_id"]],
                                r["is_replay"], r["source_date"], r["before"], r["after"], r["activity_id"],
                                list(r["tokens"]))
        else:
            g.event_ids.append(r["event_id"])
    return list(groups.values())


class Expo:
    def __init__(self, access_token: str | None, client: httpx.Client | None = None) -> None:
        self._http = client or httpx.Client(timeout=30.0)
        self._headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if access_token:
            self._headers["Authorization"] = f"Bearer {access_token}"

    def send(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        tickets: list[dict[str, Any]] = []
        for i in range(0, len(messages), BATCH):
            resp = self._http.post(EXPO_SEND, json=messages[i:i + BATCH], headers=self._headers)
            resp.raise_for_status()
            tickets += resp.json()["data"]
        return tickets

    def receipts(self, ids: list[str]) -> dict[str, dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        for i in range(0, len(ids), RECEIPT_BATCH):
            resp = self._http.post(EXPO_RECEIPTS, json={"ids": ids[i:i + RECEIPT_BATCH]}, headers=self._headers)
            resp.raise_for_status()
            out.update(resp.json()["data"])
        return out


def _dead(ticket: dict[str, Any]) -> bool:
    return ticket.get("status") == "error" and \
        (ticket.get("details") or {}).get("error") == "DeviceNotRegistered"


def send_groups(conn: Conn, expo: Expo, groups: list[Group]) -> dict[str, int]:
    """Claim (user, event) rows, send, then record tickets. Claims are released if sending fails."""
    if not groups:
        return {"push_groups": 0, "push_messages": 0, "push_ok": 0, "push_errors": 0, "tokens_disabled": 0}
    claims = [(g.user_id, e, g.is_replay) for g in groups for e in g.event_ids]
    with conn.transaction(), conn.cursor() as cur:
        cur.executemany("""insert into app.notifications (user_id, event_id, is_replay, receipt_status)
                               values (%s, %s, %s, 'sending') on conflict do nothing""", claims)
    messages = [m for g in groups for m in g.messages()]
    owners = [(g, m["to"]) for g in groups for m in g.messages()]
    try:
        tickets = expo.send(messages)
    except Exception:
        with conn.transaction():
            conn.cursor().executemany(
                "delete from app.notifications where user_id = %s and event_id = %s and receipt_status = 'sending'",
                [(u, e) for u, e, _ in claims])
        raise
    ok = errors = disabled = 0
    with conn.transaction(), conn.cursor() as cur:
        for (g, token), t in zip(owners, tickets, strict=True):
            status = "ticket_ok" if t.get("status") == "ok" else f"ticket_error:{t.get('message', '')}"[:300]
            ok += t.get("status") == "ok"
            errors += t.get("status") != "ok"
            if _dead(t):
                cur.execute("update app.devices set disabled_at = now() where expo_push_token = %s", (token,))
                disabled += 1
            # One row per (user, event) even with several devices: a failed ticket never replaces a good one.
            cur.executemany(
                """update app.notifications set expo_push_token = %s, ticket_id = %s, receipt_status = %s,
                   error = %s, sent_at = now()
                   where user_id = %s and event_id = %s and (%s or receipt_status is distinct from 'ticket_ok')""",
                [(token, t.get("id"), status, None if t.get("status") == "ok" else t.get("message"), g.user_id, e,
                  t.get("status") == "ok") for e in g.event_ids])
    log.info("notify.sent", groups=len(groups), messages=len(messages), ok=ok, errors=errors, disabled=disabled)
    return {"push_groups": len(groups), "push_messages": len(messages), "push_ok": ok, "push_errors": errors,
            "tokens_disabled": disabled}


def check_receipts(conn: Conn, expo: Expo, min_age_minutes: int = 15) -> dict[str, int]:
    rows = conn.execute(
        """select distinct ticket_id, expo_push_token from app.notifications
           where ticket_id is not null and receipt_checked_at is null
             and sent_at < now() - make_interval(mins => %s)""", (min_age_minutes,)).fetchall()
    if not rows:
        return {"receipts_checked": 0, "receipts_errors": 0}
    receipts = expo.receipts([r[0] for r in rows])
    errors = 0
    with conn.transaction(), conn.cursor() as cur:
        for ticket_id, token in rows:
            rec = receipts.get(ticket_id)
            if rec is None:
                continue  # not ready yet; try next run
            status = "delivered_to_provider" if rec.get("status") == "ok" else f"error:{rec.get('message', '')}"
            errors += rec.get("status") != "ok"
            cur.execute("""update app.notifications set receipt_status = %s, receipt_checked_at = now()
                           where ticket_id = %s""", (status[:300], ticket_id))
            if _dead(rec):
                cur.execute("update app.devices set disabled_at = now() where expo_push_token = %s", (token,))
    return {"receipts_checked": len(receipts), "receipts_errors": errors}


def notify(conn: Conn, expo: Expo, event_ids: Sequence[int] | None = None) -> dict[str, int]:
    counts = check_receipts(conn, expo)
    counts.update(send_groups(conn, expo, pending_groups(conn, event_ids)))
    return counts


REPLAY_INSERT = """
insert into core.change_events (operation_id, kind, ref_id, before, after, source_date, is_replay)
select v.operation_id, 'new_violation', v.non_compliance_id::text, null,
       jsonb_build_object('activity_id', v.activity_id, 'risk_level', v.risk_level, 'category', v.category,
                          'standard', v.standard_code),
       v.activity_date, true
from core.violations v where v.non_compliance_id = %s
returning id, operation_id, source_date
"""


def replay(settings: Settings, non_compliance_id: int, expo: Expo | None = None,
           dry_run: bool = False) -> dict[str, Any]:
    """Resend a real past finding to everyone watching its daycare, labelled as a replay.

    Each call is a new event (replays are never deduped against each other). A dry run builds the
    exact pushes, then rolls back: no event is kept, Expo is never called, no token is touched.
    """
    with connect(settings.require_db()) as conn:
        conn.execute("begin")
        row = conn.execute(REPLAY_INSERT, (non_compliance_id,)).fetchone()
        if row is None:
            conn.rollback()
            raise SystemExit(f"no finding with non_compliance_id {non_compliance_id} in core.violations")
        event_id, operation_id, source_date = row
        groups = pending_groups(conn, [event_id])
        result: dict[str, Any] = {
            "event_id": event_id, "operation_id": operation_id, "non_compliance_id": non_compliance_id,
            "source_date": source_date, "dry_run": dry_run, "recipients": len(groups),
            "messages": [{**m, "to": m["to"][:22] + "…"} for g in groups for m in g.messages()]}
        if dry_run:
            conn.rollback()
            result["event_id"] = None
        else:
            conn.commit()
            result.update(send_groups(conn, expo or Expo(settings.expo_access_token), groups))
    log.info("replay.done", event_id=result["event_id"], recipients=len(groups), dry_run=dry_run)
    return result


LATEST_FINDING = """
select non_compliance_id from core.violations where operation_id = %s
order by activity_date desc nulls last, non_compliance_id desc limit 1
"""


def latest_finding(settings: Settings, operation_id: int) -> int:
    """The newest real finding the state posted for this daycare; exits with a reason if it has none."""
    with connect(settings.require_db()) as conn:
        known = conn.execute("select 1 from core.daycares where operation_id = %s", (operation_id,)).fetchone()
        row = conn.execute(LATEST_FINDING, (operation_id,)).fetchone()
    if known is None:
        raise SystemExit(f"no daycare with operation_id {operation_id} in core.daycares")
    if row is None:
        raise SystemExit(f"daycare {operation_id} has no findings on record, so there is nothing real to replay; "
                         "pick a daycare with at least one finding")
    return int(row[0])


def replay_latest(settings: Settings, operation_id: int, expo: Expo | None = None,
                  dry_run: bool = False) -> dict[str, Any]:
    """Replay the newest real finding at a daycare, so a tester can watch any daycare and get a push."""
    return replay(settings, latest_finding(settings, operation_id), expo, dry_run)


def receipts_now(settings: Settings, min_age_minutes: int = 0, expo: Expo | None = None) -> dict[str, Any]:
    """python -m pipeline receipts: check pending Expo receipts now and show the newest sends."""
    with connect(settings.require_db()) as conn:
        result: dict[str, Any] = dict(check_receipts(conn, expo or Expo(settings.expo_access_token),
                                                     min_age_minutes))
        result["latest"] = [
            {"event_id": r[0], "ticket_id": r[1], "receipt_status": r[2], "sent_at": r[3],
             "to": (r[4] or "")[:22] + "…"}
            for r in conn.execute("""select event_id, ticket_id, receipt_status, sent_at, expo_push_token
                                     from app.notifications order by sent_at desc nulls last limit 10""")]
    return result
