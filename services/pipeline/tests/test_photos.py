"""Photos: geometry, the skip-without-token path, and (with a local DB) the fill + coverage plumbing.

Selection on real Mapillary images is tested against recorded API responses in fixtures/mapillary/
(captured by the daily-sync photos run); no image record here is invented.
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
from pipeline.photos import (
    Mapillary,
    angle_delta,
    bbox,
    bearing,
    candidates,
    choose,
    distance_m,
    not_before,
    travel_heading,
)

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
        heading = travel_heading(by_id[p.image_id], rec["data"])
        assert heading is not None
        assert photos.SIDEWAYS_MIN <= angle_delta(p.compass_angle, heading) <= photos.SIDEWAYS_MAX
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


def _along_road(rec: dict[str, Any], image_id: str) -> float:
    img = next(i for i in rec["data"] if str(i["id"]) == image_id)
    heading = travel_heading(img, rec["data"])
    assert heading is not None
    return angle_delta(float(img["computed_compass_angle"]), heading)


@pytest.mark.parametrize(("op", "was_kept"), [
    # Messiah Lutheran Lambs, Plano: the three Oct 2026 frames the facing rule alone used to keep
    ("241227", ["1745539040910477", "1088186357444605", "1007654932346439"]),
    # The Goddard School Frisco West: two frames 1 s apart looking straight down the street
    ("1491391", ["25180809851546196", "1185325416404177"]),
])
def test_recorded_dashcam_frames_are_dropped(op: str, was_kept: list[str]) -> None:
    rec = _recorded(op)
    for image_id in was_kept:
        delta = _along_road(rec, image_id)
        assert delta < photos.SIDEWAYS_MIN or delta > photos.SIDEWAYS_MAX  # looking along the road
    assert candidates(rec["data"], rec["lat"], rec["lng"]) == []


def test_recorded_side_view_photos_are_kept() -> None:
    rec = _recorded("1396589")  # The Nest School Plano: a side camera driving past on Dec 5 2023
    kept = choose(candidates(rec["data"], rec["lat"], rec["lng"], not_before(None, NOW)))
    assert [p.image_id for p in kept] == ["808869684405055", "794245349258249", "2412976785563492"]
    assert all(p.captured_at.date() == date(2023, 12, 5) for p in kept)
    assert all(photos.SIDEWAYS_MIN <= _along_road(rec, p.image_id) <= photos.SIDEWAYS_MAX for p in kept)


def test_choose_skips_frames_from_the_same_moment_and_angle() -> None:
    rec = _recorded("1396589")
    every = candidates(rec["data"], rec["lat"], rec["lng"])
    kept = choose(every)
    assert len(every) > len(kept)  # the same pass offered more frames than it adds
    for i, a in enumerate(kept):
        for b in kept[i + 1:]:
            close_in_time = abs((a.captured_at - b.captured_at).total_seconds()) < photos.SAME_SHOT_S
            assert not (close_in_time and angle_delta(a.compass_angle, b.compass_angle) < photos.SAME_SHOT_DEG)


def test_travel_heading_needs_a_neighbor_frame() -> None:
    rec = _recorded("1396589")
    lone = dict(next(i for i in rec["data"] if str(i["id"]) == "808869684405055"))
    assert travel_heading(lone, [lone]) is None
    assert candidates([lone], rec["lat"], rec["lng"]) == []


def test_recorded_old_photo_is_dropped_by_age() -> None:
    rec = _recorded("216581")  # its only side views are from Jul 2014
    kept = choose(candidates(rec["data"], rec["lat"], rec["lng"]))
    assert [p.image_id for p in kept] == ["465263094805183"]
    assert all(p.captured_at.year == 2014 for p in kept)
    assert candidates(rec["data"], rec["lat"], rec["lng"], not_before(None, NOW)) == []


def test_recorded_photo_before_the_permit_is_dropped() -> None:
    rec = _recorded("1396589")
    assert candidates(rec["data"], rec["lat"], rec["lng"], not_before(date(2023, 12, 6), NOW)) == []


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
            (expected, points) = conn.execute(f"""select count(*), count(distinct (round(lat::numeric, 7),
                round(lng::numeric, 7))) from ({photos.TARGETS}) t""").fetchone() or (0, 0)
            homes_or_approx = conn.execute(f"""select count(*) from ({photos.TARGETS}) t join core.daycares d
                using (operation_id) where d.operation_type <> 'Licensed Center'
                or d.geocode_quality <> 'exact'""").fetchone()
            assert homes_or_approx == (0,)
            counts = photos.fill(conn, api, record_dir=tmp_path)
            assert counts["photos_targets"] == expected == counts["photos_queried"]
            assert len(asked) == len(set(asked)) == points  # one request per point, shared addresses once
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


def test_runner_reports_a_photo_problem_without_failing(monkeypatch: pytest.MonkeyPatch) -> None:
    from pipeline import runner

    def broken(conn: Any, path: Path = photos.VERIFIED_CSV) -> dict[str, Any]:
        raise ValueError("bad row")

    monkeypatch.setattr(photos, "load_verified", broken)
    monkeypatch.setattr(runner, "connect", lambda url: _NullConn())
    assert runner._photos("postgresql://unused") == {"photos_error": "ValueError"}


class _NullConn:
    def __enter__(self) -> _NullConn:
        return self

    def __exit__(self, *exc: object) -> None:
        return None


def test_committed_verified_list_is_well_formed() -> None:
    rows = photos.read_verified()
    assert len({(r["operation_id"], r["image_id"]) for r in rows}) == len(rows)
    per_center: dict[str, list[dict[str, str]]] = {}
    for r in rows:
        per_center.setdefault(r["operation_id"], []).append(r)
        datetime.fromisoformat(r["captured_at"]) and datetime.fromisoformat(r["reviewed_at"])
        assert 0 <= float(r["distance_m"]) <= 2 * photos.RADIUS_M
    for kept in per_center.values():  # two photos of one center come from different drives
        assert len(kept) <= 2 and len({r["sequence_id"] for r in kept}) == len(kept)


def test_verified_list_rejects_a_row_missing_a_field(tmp_path: Path) -> None:
    bad = tmp_path / "v.csv"
    bad.write_text(",".join(photos.VERIFIED_COLUMNS) + "\n1459611,123,2024-06-01T00:00:00+00:00,someone,,10,90,"
                   "2026-10-25T13:00:00-05:00,front of the building\n")
    with pytest.raises(ValueError, match="line 2"):
        photos.read_verified(bad)


@pytest.mark.db
@pytest.mark.skipif(not DB, reason="DATABASE_URL not set")
def test_load_verified_makes_the_list_the_only_verified_photos(tmp_path: Path) -> None:
    assert DB
    with psycopg.connect(DB) as conn:
        tx = conn.transaction()
        tx.__enter__()
        try:
            op = conn.execute(f"select operation_id from ({photos.TARGETS}) t limit 1").fetchone()
            assert op
            conn.execute("""insert into core.daycare_photos (operation_id, image_id, captured_at, distance_m,
                            verified, verified_at) values (%s, 'stale', now(), 1, true, now())""", op)
            listed = tmp_path / "v.csv"
            listed.write_text(",".join(photos.VERIFIED_COLUMNS) + f"\n{op[0]},listed,2025-06-01T00:00:00+00:00,"
                              ",seq,12.5,90,2026-10-25T13:00:00-05:00,front of the building\n")
            counts = photos.load_verified(conn, listed)
            assert counts == {"photos_verified": 1, "photos_verified_centers": 1, "photos_two_centers": 0}
            sql = "select image_id, verified from core.daycare_photos where operation_id = %s"
            got: dict[str, bool] = dict(conn.execute(sql, op).fetchall())
            assert got["listed"] is True and got["stale"] is False
            assert photos.load_verified(conn, listed) == counts  # idempotent
        finally:
            tx.__exit__(psycopg.Rollback, psycopg.Rollback(), None)


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


def test_recorded_shared_point_replays_every_image_seen_there(tmp_path: Path) -> None:
    # Three permits at one address: the same box came back with 92, 79, and 39 images.
    ops = ["1529028", "232962", "1527897"]
    recs = [_recorded(op) for op in ops]
    assert len({(r["lat"], r["lng"]) for r in recs}) == 1
    union = {str(i["id"]) for r in recs for i in r["data"]}
    for op in ops:
        (tmp_path / f"{op}.json").write_text((RECORDED / f"{op}.json").read_text())
    replay = photos.Recorded(tmp_path).images_near(recs[0]["lat"], recs[0]["lng"])
    assert {str(i["id"]) for i in replay} == union
    assert len(replay) == len(union) > max(len(r["data"]) for r in recs)
