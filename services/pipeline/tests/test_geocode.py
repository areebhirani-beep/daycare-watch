"""Census batch geocoding, tested against recorded real responses (no network)."""

from __future__ import annotations

import csv
import json
import os
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import psycopg
import pytest

from pipeline import geocode
from pipeline.geocode import GeocodeError, build_csv, parse_response, post_batch, split_address
from tests.conftest import FIXTURES

REC = FIXTURES / "recorded"
DB = os.environ.get("DATABASE_URL")


def recorded(n: str = "") -> tuple[list[tuple[int, str]], str]:
    """(operation_id, geocode_address) pairs that were sent, and the raw Census response."""
    with (REC / f"census_batch_request{n}.csv").open(newline="") as f:
        sent = [(int(r[0]), f"{r[1]}, {r[2]}, {r[3]} {r[4]}") for r in csv.reader(f)]
    return sent, (REC / f"census_batch_response{n}.csv").read_text()


def test_split_address() -> None:
    assert split_address("2532 HIGHWAY 82 E STE 5, WHITESBORO, TX 76273") == (
        "2532 HIGHWAY 82 E STE 5", "WHITESBORO", "TX", "76273")
    assert split_address("100 A ST, BLDG 2, PARIS, TX 75460") == ("100 A ST, BLDG 2", "PARIS", "TX", "75460")
    assert split_address("NO COMMAS") == ("NO COMMAS", "", "", "")


def test_build_csv_matches_recorded_request() -> None:
    sent, _ = recorded()
    assert build_csv(sent) == (REC / "census_batch_request.csv").read_text()
    assert build_csv([(1, 'SUITE "B", 5 MAIN ST, PARIS, TX 75460')]) == '1,"SUITE ""B"", 5 MAIN ST",PARIS,TX,75460\n'


def test_parse_recorded_matches_lon_lat_order() -> None:
    sent, text = recorded()
    got = parse_response(text, {oid for oid, _ in sent})
    assert set(got) == {oid for oid, _ in sent}
    assert all(e["match"] == "Match" for e in got.values())
    assert sum(e["exactness"] == "Non_Exact" for e in got.values()) == 2
    plano = got[94402]  # 1111 H AVE STE 100, PLANO: longitude first in the response
    assert (plano["lon"], plano["lat"]) == (-96.703700419445, 33.013732845401)
    assert got[113125]["matched_address"] == "200 JORDAN RD, MC KINNEY, TX, 75070"


def test_parse_tie_no_match_and_strays() -> None:
    sent, text = recorded("_2")
    got = parse_response(text, {oid for oid, _ in sent})
    kinds = {e["match"] for e in got.values()}
    assert kinds <= {"Match", "No_Match", "Tie"} and "No_Match" in kinds
    assert all("lon" not in e for e in got.values() if e["match"] != "Match")
    extra = '"7","X","Tie"\n"8","Y","Match","Exact","Y","",""\n"9","Z","Match","Exact","Z","-96.1,33.2","1","L"\n'
    more = parse_response(extra, {7, 8})  # 9 was never sent; 8 has no coordinate
    assert {k: v["match"] for k, v in more.items()} == {7: "Tie", 8: "No_Match"}


def test_post_batch_retries_then_succeeds() -> None:
    _, text = recorded()
    calls: list[bytes] = []

    def handle(req: httpx.Request) -> httpx.Response:
        calls.append(req.read())
        if len(calls) == 1:
            return httpx.Response(503)
        if len(calls) == 2:
            raise httpx.ReadTimeout("slow", request=req)
        return httpx.Response(200, text=text)

    waits: list[float] = []
    assert post_batch(httpx.Client(transport=httpx.MockTransport(handle)), "1,A,B,TX,1", waits.append) == text
    assert waits == [5.0, 10.0]
    body = calls[0].decode()
    assert 'name="addressFile"' in body and "Public_AR_Current" in body and "1,A,B,TX,1" in body


def test_post_batch_fails_fast_on_400() -> None:
    calls: list[int] = []

    def handle(req: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(400, text="bad file")

    with pytest.raises(GeocodeError, match="HTTP 400"):
        post_batch(httpx.Client(transport=httpx.MockTransport(handle)), "x", lambda _s: None)
    assert calls == [1]


def test_negative_cache_expires() -> None:
    now = datetime.now(UTC)
    assert geocode._fresh_negative({"match": "No_Match", "at": (now - timedelta(days=1)).isoformat()}, now)
    assert not geocode._fresh_negative({"match": "Tie", "at": (now - timedelta(days=8)).isoformat()}, now)


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_update_guard_and_cache(tmp_path: Path) -> None:
    assert DB
    with psycopg.connect(DB) as conn:
        def make_pending() -> list[int]:
            """Two real rows put back to 'never geocoded'; every change here is rolled back."""
            ids = [r[0] for r in conn.execute("""select operation_id from core.daycares
                where geocode_source = 'census' order by operation_id limit 2""").fetchall()]
            if len(ids) < 2:
                pytest.skip("no census-geocoded rows to reset")
            conn.execute("""update core.daycares set geom = null, geocode_source = null, geocode_quality = null,
                district_basis = null, geocode_attempted_at = null where operation_id = any(%s)""", (ids,))
            conn.execute("""update core.daycares set geocode_quality = 'exact'
                where geocode_source = 'census' and geocode_quality is null""")
            conn.execute("""update core.daycares set geocode_attempted_at = coalesce(geocode_attempted_at, now())
                where geom is null and not (operation_id = any(%s))""", (ids,))
            return ids

        a, b = make_pending()
        cache = tmp_path / "cache.json"

        def echo(req: httpx.Request) -> httpx.Response:
            # The address of b changes while the request is out: its answer must not be written.
            conn.execute("update core.daycares set geocode_address = geocode_address || ' X' "
                         "where operation_id = %s", (b,))
            ids = re.findall(r"^(\d+),", req.read().decode(), re.M)
            return httpx.Response(200, text="".join(
                f'"{i}","x","Match","Exact","x","-96.6,33.6","1","L"\n' for i in ids))

        try:
            n = geocode.geocode_pending(conn, httpx.Client(transport=httpx.MockTransport(echo)), limit=2,
                                        cache_path=cache, sleep=lambda _s: None)
            assert (n["geocode_sent"], n["geocode_matched"], n["geocode_written"]) == (2, 2, 1)
            got: dict[int, str | None] = dict(conn.execute("select operation_id, geocode_source from core.daycares "
                                    "where operation_id = any(%s)", ([a, b],)).fetchall())
            assert got == {a: "census", b: None}
            q = conn.execute("select geocode_quality from core.daycares where operation_id = %s", (a,)).fetchone()
            assert q == ("exact",)
            assert len(json.loads(cache.read_text())) == 2
            attempted = conn.execute("""select count(*) from core.daycares
                where operation_id = any(%s) and geocode_attempted_at is not null""", ([a, b],)).fetchone()
            assert attempted == (2,)
        finally:
            conn.rollback()

        def offline(req: httpx.Request) -> httpx.Response:
            raise AssertionError("cached addresses must not be re-sent")

        try:
            make_pending()
            n = geocode.geocode_pending(conn, httpx.Client(transport=httpx.MockTransport(offline)), limit=2,
                                        cache_path=cache)
            assert (n["geocode_cached"], n["geocode_sent"], n["geocode_written"]) == (2, 0, 2)
        finally:
            conn.rollback()


def test_quality_from_match_type() -> None:
    assert geocode.quality({"match": "Match", "exactness": "Exact"}) == "exact"
    assert geocode.quality({"match": "Match", "exactness": "Non_Exact"}) == "non_exact"


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_legacy_census_rows_get_quality_without_moving(tmp_path: Path) -> None:
    """A row matched before geocode_quality existed: the cache fills the match type; point and district stay."""
    assert DB
    with psycopg.connect(DB) as conn:
        try:
            row = conn.execute("""select operation_id, geocode_address, geom::text, district_basis
                from core.daycares where geocode_source = 'census' order by operation_id limit 1""").fetchone()
            if row is None:
                pytest.skip("no census-geocoded rows")
            oid, addr, geom, basis = row
            conn.execute("update core.daycares set geocode_quality = 'exact' "
                         "where geocode_source = 'census' and operation_id <> %s", (oid,))
            conn.execute("update core.daycares set geocode_quality = null where operation_id = %s", (oid,))
            conn.execute("update core.daycares set geocode_attempted_at = now() where geom is null")
            cache = tmp_path / "cache.json"
            cache.write_text(json.dumps({addr: {"match": "Match", "exactness": "Non_Exact", "lon": 0.0, "lat": 0.0,
                                                "matched_address": "x", "at": "2026-10-24T00:00:00+00:00"}}))

            def offline(req: httpx.Request) -> httpx.Response:
                raise AssertionError("cached addresses must not be re-sent")

            n = geocode.geocode_pending(conn, httpx.Client(transport=httpx.MockTransport(offline)), cache_path=cache)
            assert (n["geocode_pending"], n["geocode_written"], n["geocode_quality_filled"]) == (1, 0, 1)
            after = conn.execute("""select geocode_quality, geom::text, district_basis from core.daycares
                where operation_id = %s""", (oid,)).fetchone()
            assert after == ("non_exact", geom, basis)
        finally:
            conn.rollback()
