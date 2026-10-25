"""Photos: geometry, the skip-without-token path, and (with a local DB) the fill + coverage plumbing.

Selection on real Mapillary images is tested against recorded API responses in fixtures/mapillary/
once they are captured; no image record here is invented.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import httpx
import psycopg
import pytest

from pipeline import photos
from pipeline.photos import Mapillary, angle_delta, bbox, bearing, candidates, choose, distance_m, not_before

RECORDED = Path(__file__).parent.parent / "fixtures" / "mapillary"


def test_bearing_cardinal_directions() -> None:
    lat, lng = 33.1507, -96.8236
    assert bearing(lat, lng, lat + 0.001, lng) == pytest.approx(0, abs=0.01)
    assert bearing(lat, lng, lat, lng + 0.001) == pytest.approx(90, abs=0.1)
    assert bearing(lat, lng, lat - 0.001, lng) == pytest.approx(180, abs=0.01)
    assert bearing(lat, lng, lat, lng - 0.001) == pytest.approx(270, abs=0.1)


def test_angle_delta_wraps() -> None:
    assert angle_delta(350, 10) == 20
    assert angle_delta(10, 350) == 20
    assert angle_delta(0, 180) == 180
    assert angle_delta(90, 90) == 0


def test_distance_and_bbox_agree_on_radius() -> None:
    lat, lng = 33.1507, -96.8236
    min_lng, min_lat, max_lng, max_lat = map(float, bbox(lat, lng).split(","))
    assert distance_m(lat, lng, max_lat, lng) == pytest.approx(photos.RADIUS_M, rel=1e-3)
    assert distance_m(lat, lng, lat, max_lng) == pytest.approx(photos.RADIUS_M, rel=1e-3)
    assert min_lat < lat < max_lat and min_lng < lng < max_lng


def test_token_travels_in_header_never_in_url() -> None:
    seen: list[httpx.Request] = []

    def handle(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json={"data": []})

    api = Mapillary("tok-for-test", httpx.Client(transport=httpx.MockTransport(handle)))
    assert api.images_near(33.1507, -96.8236) == []
    (req,) = seen
    assert req.headers["authorization"] == "OAuth tok-for-test"
    assert "tok-for-test" not in str(req.url)
    assert req.url.params["fields"] == photos.FIELDS


def test_retries_rate_limit_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(photos.time, "sleep", lambda _s: None)
    codes = iter([429, 503, 200])

    def handle(req: httpx.Request) -> httpx.Response:
        code = next(codes)
        return httpx.Response(code, json={"data": []} if code == 200 else {})

    api = Mapillary("t", httpx.Client(transport=httpx.MockTransport(handle)))
    assert api.images_near(33.15, -96.82) == []


def test_empty_answer_keeps_nothing() -> None:
    assert choose(candidates([], 33.15, -96.82)) == []


@pytest.mark.skipif(not RECORDED.exists(), reason="no recorded Mapillary responses yet")
@pytest.mark.parametrize("path", sorted(RECORDED.glob("*.json")) if RECORDED.exists() else [],
                         ids=lambda p: p.stem)
def test_recorded_responses_obey_the_rules(path: Path) -> None:
    rec: dict[str, Any] = json.loads(path.read_text())
    kept = choose(candidates(rec["data"], rec["lat"], rec["lng"]))
    assert len(kept) <= photos.MAX_PHOTOS
    by_id = {str(i["id"]): i for i in rec["data"]}
    for p in kept:
        assert p.distance_m <= photos.RADIUS_M and p.facing_delta <= photos.FACING_MAX
        assert not by_id[p.image_id].get("is_pano")
    # Preferred-facing photos always come before wider ones, newest first within each group.
    keys = [(p.facing_delta > photos.FACING_PREFERRED, -p.captured_at.timestamp()) for p in kept]
    assert keys == sorted(keys)


def _recorded(op: str) -> dict[str, Any]:
    rec: dict[str, Any] = json.loads((RECORDED / f"{op}.json").read_text())
    return rec


NOW = datetime(2026, 10, 25, tzinfo=UTC)


def test_not_before_is_the_later_of_permit_and_six_years() -> None:
    assert not_before(None, NOW) == datetime(2020, 10, 25, tzinfo=UTC)
    assert not_before(date(2016, 1, 4), NOW) == datetime(2020, 10, 25, tzinfo=UTC)
    assert not_before(date(2024, 3, 1), NOW) == datetime(2024, 3, 1, tzinfo=UTC)
    assert not_before(None, datetime(2028, 2, 29, tzinfo=UTC)) == datetime(2022, 2, 28, tzinfo=UTC)


def test_recorded_plano_center_keeps_three_new_facing_photos() -> None:
    rec = _recorded("241227")  # Messiah Lutheran Lambs, Plano: 42 images within the box
    kept = choose(candidates(rec["data"], rec["lat"], rec["lng"], not_before(None, NOW)))
    assert [p.image_id for p in kept] == ["1745539040910477", "1088186357444605", "1007654932346439"]
    assert all(p.captured_at.date() == date(2026, 10, 17) and p.facing_delta <= 45 for p in kept)


def test_recorded_old_photo_is_dropped_by_age() -> None:
    rec = _recorded("1508243")  # Frisco: its one usable photo is from Jul 2019
    assert [p.image_id for p in choose(candidates(rec["data"], rec["lat"], rec["lng"]))] == ["147745507366382"]
    assert candidates(rec["data"], rec["lat"], rec["lng"], not_before(None, NOW)) == []


def test_recorded_photo_before_the_permit_is_dropped() -> None:
    rec = _recorded("241227")
    assert candidates(rec["data"], rec["lat"], rec["lng"], not_before(date(2026, 10, 18), NOW)) == []


def test_recorded_panoramas_are_never_kept() -> None:
    rec = _recorded("1251368")  # 15 images near this center, all panoramas
    assert rec["data"] and all(i["is_pano"] for i in rec["data"])
    assert candidates(rec["data"], rec["lat"], rec["lng"]) == []


# ---------------------------------------------------------------- local DB

DB = os.environ.get("DATABASE_URL")


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_fill_queries_only_exact_tx04_centers_and_reports_coverage(tmp_path: Path) -> None:
    asked: list[str] = []

    def handle(req: httpx.Request) -> httpx.Response:
        asked.append(req.url.params["bbox"])
        return httpx.Response(200, json={"data": []})

    api = Mapillary("t", httpx.Client(transport=httpx.MockTransport(handle)))
    assert DB
    with psycopg.connect(DB) as conn:
        tx = conn.transaction()
        tx.__enter__()
        try:
            (expected,) = conn.execute(f"select count(*) from ({photos.TARGETS}) t").fetchone() or (0,)
            homes_or_approx = conn.execute(f"""select count(*) from ({photos.TARGETS}) t join core.daycares d
                using (operation_id) where d.operation_type <> 'Licensed Center'
                or d.geocode_quality <> 'exact'""").fetchone()
            assert homes_or_approx == (0,)
            counts = photos.fill(conn, api, record_dir=tmp_path)
            assert counts["photos_targets"] == expected == len(asked) == counts["photos_queried"]
            assert counts["photos_kept"] == 0 and counts["photos_failed"] == 0
            assert len(list(tmp_path.glob("*.json"))) == expected
            cov = photos.coverage(conn)
            assert cov["targets"] == expected and cov["with_photo"] == 0
        finally:
            tx.__exit__(psycopg.Rollback, psycopg.Rollback(), None)


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_failed_request_leaves_stored_photos_alone() -> None:
    def handle(req: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"message": "bad"}})

    api = Mapillary("t", httpx.Client(transport=httpx.MockTransport(handle)))
    assert DB
    with psycopg.connect(DB) as conn:
        tx = conn.transaction()
        tx.__enter__()
        try:
            before = conn.execute("select count(*) from core.daycare_photos").fetchone()
            counts = photos.fill(conn, api)
            assert counts["photos_failed"] == counts["photos_targets"] and counts["photos_queried"] == 0
            assert conn.execute("select count(*) from core.daycare_photos").fetchone() == before
        finally:
            tx.__exit__(psycopg.Rollback, psycopg.Rollback(), None)


def test_runner_skips_photos_without_token(monkeypatch: pytest.MonkeyPatch) -> None:
    from pipeline import runner

    monkeypatch.delenv("MAPILLARY_TOKEN", raising=False)
    assert runner._photos("postgresql://unused") == {"photos_skipped": "no token"}


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_recorded_answers_replay_through_fill(tmp_path: Path) -> None:
    """Record with an empty API, then fill from that folder: same targets, nothing invented."""
    api = Mapillary("t", httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"data": []}))))
    assert DB
    with psycopg.connect(DB) as conn:
        first = photos.fill(conn, api, record_dir=tmp_path, dry_run=True)
        again = photos.fill(conn, photos.Recorded(tmp_path), dry_run=True)
    assert again["photos_queried"] == first["photos_queried"] == first["photos_targets"]
    assert again["photos_failed"] == 0


def test_recorded_missing_point_is_a_failed_request(tmp_path: Path) -> None:
    with pytest.raises(httpx.HTTPError, match="no recorded answer"):
        photos.Recorded(tmp_path).images_near(33.15, -96.82)
