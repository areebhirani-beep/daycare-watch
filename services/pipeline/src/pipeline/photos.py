"""Stage 5c: street-level photos from Mapillary for licensed centers in TX-04.

Only hand-verified photos are ever shown. A person looks at each candidate and records it in
data/verified_photos.csv only when it shows that daycare's building; the daily sync loads that file
(load_verified) and calls no API. Everything below finds candidates for that review.

Only active Licensed Centers whose point is an exact Census match and inside the district get a
query; home daycares and approximate points never do (daycare_record also refuses to show photos
for them). For each center one Graph API call lists the images in a box of +-RADIUS_M around the
point. An image is kept when it lies within RADIUS_M, is not a panorama (a flat crop of an
equirectangular image reads as broken), its camera points at the daycare within +-FACING_MAX, and
the camera looks sideways from its own direction of travel (SIDEWAYS_MIN..SIDEWAYS_MAX degrees).
Most street imagery here is dashcam: the Census point sits on the street, so a forward camera
"faces" it while showing only the road ahead. The direction of travel comes from the same
sequence's frames a few seconds before and after; an image with no such neighbors is not kept.
Up to MAX_PHOTOS are kept: those facing within +-FACING_PREFERRED first, then newest, then nearest,
skipping a frame taken within SAME_SHOT_S of a kept one and pointing within SAME_SHOT_DEG of it.
A photo older than the daycare's permit may show a different business, and one older than
MAX_AGE_YEARS may show a different street, so neither is kept.

The token comes from MAPILLARY_TOKEN only and travels in a header, never in a URL or a log line.
Without a token the stage is skipped and the run stays ok. A failed request leaves that center's
stored photos as they were.
"""

from __future__ import annotations

import json
import math
import os
import time
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import httpx
import structlog

from pipeline.load import Conn

log = structlog.get_logger()

GRAPH_IMAGES = "https://graph.mapillary.com/images"
FIELDS = ("id,captured_at,computed_geometry,geometry,compass_angle,computed_compass_angle,is_pano,"
          "creator,sequence,thumb_1024_url")
RADIUS_M = 50.0
SEARCH_M = 100.0  # the box asked for: wide enough for a building set back from its street address point
MAX_PHOTOS = 3
FACING_MAX = 60.0
FACING_PREFERRED = 45.0
MAX_AGE_YEARS = 6
SIDEWAYS_MIN, SIDEWAYS_MAX = 45.0, 135.0
TRACK_WINDOW_MS = 10_000
TRACK_MIN_M, TRACK_MAX_M = 1.0, 80.0
SAME_SHOT_S, SAME_SHOT_DEG = 60.0, 30.0
MAX_ATTEMPTS = 4
LIMIT = 2000  # the API's maximum; below it the same box came back as 92, 79, and 39 different images
EARTH_M = 6_371_008.8

TARGETS = """
select operation_id, st_y(geom::geometry) as lat, st_x(geom::geometry) as lng, issuance_date from core.daycares
where operation_type = 'Licensed Center' and operation_status = 'Y'
  and geocode_source = 'census' and geocode_quality = 'exact'
  and in_district and district_basis = 'point' and geom is not null
order by operation_id
"""


@dataclass(frozen=True)
class Photo:
    image_id: str
    captured_at: datetime
    distance_m: float
    compass_angle: float
    facing_delta: float


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in meters."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_M * math.asin(math.sqrt(a))


def bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial compass bearing from point 1 to point 2, in degrees [0, 360)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lng2 - lng1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return math.degrees(math.atan2(y, x)) % 360


def angle_delta(a: float, b: float) -> float:
    """Smallest difference between two compass angles, in degrees [0, 180]."""
    d = abs(a - b) % 360
    return 360 - d if d > 180 else d


def bbox(lat: float, lng: float, radius_m: float = RADIUS_M) -> str:
    dlat = math.degrees(radius_m / EARTH_M)
    dlng = math.degrees(radius_m / (EARTH_M * math.cos(math.radians(lat))))
    return f"{lng - dlng:.7f},{lat - dlat:.7f},{lng + dlng:.7f},{lat + dlat:.7f}"


def not_before(issuance_date: date | None, now: datetime) -> datetime:
    """The oldest capture time we keep: the permit's issue date or MAX_AGE_YEARS ago, whichever is later."""
    try:
        oldest = now.replace(year=now.year - MAX_AGE_YEARS)
    except ValueError:  # Feb 29
        oldest = now.replace(year=now.year - MAX_AGE_YEARS, day=28)
    if issuance_date is not None:
        oldest = max(oldest, datetime(issuance_date.year, issuance_date.month, issuance_date.day, tzinfo=UTC))
    return oldest


def _position(img: dict[str, Any]) -> tuple[float, float] | None:
    geom = img.get("computed_geometry") or img.get("geometry") or {}
    coords = geom.get("coordinates") if isinstance(geom, dict) else None
    return (float(coords[1]), float(coords[0])) if coords else None


def travel_heading(img: dict[str, Any], images: list[dict[str, Any]]) -> float | None:
    """The camera's direction of travel: from the nearest-in-time frame before it to the one after.

    Neighbors are frames taken within TRACK_WINDOW_MS and TRACK_MIN_M..TRACK_MAX_M away. With only
    one side present, the image itself is the other end. None when there is no neighbor at all.
    """
    here, t = _position(img), img.get("captured_at")
    if here is None or t is None:
        return None
    before: tuple[int, tuple[float, float]] | None = None
    after: tuple[int, tuple[float, float]] | None = None
    for other in images:
        there, ot = _position(other), other.get("captured_at")
        if other is img or there is None or ot is None:
            continue
        dt = int(ot) - int(t)
        if dt == 0 or abs(dt) > TRACK_WINDOW_MS:
            continue
        if not TRACK_MIN_M <= distance_m(*here, *there) <= TRACK_MAX_M:
            continue
        if dt < 0 and (before is None or dt > before[0]):
            before = (dt, there)
        elif dt > 0 and (after is None or dt < after[0]):
            after = (dt, there)
    start = before[1] if before else here
    end = after[1] if after else here
    return None if start == end else bearing(*start, *end)


def candidates(
    images: Iterable[dict[str, Any]], lat: float, lng: float, oldest: datetime | None = None
) -> list[Photo]:
    """Images that show the daycare as it is: close, flat, facing it from the side, not older than `oldest`."""
    images = list(images)
    out: list[Photo] = []
    for img in images:
        pos = _position(img)
        angle = img.get("computed_compass_angle", img.get("compass_angle"))
        if img.get("is_pano") or pos is None or angle is None or img.get("captured_at") is None:
            continue
        ilat, ilng = pos
        dist = distance_m(ilat, ilng, lat, lng)
        if dist > RADIUS_M:
            continue
        delta = angle_delta(float(angle), bearing(ilat, ilng, lat, lng))
        if delta > FACING_MAX:
            continue
        heading = travel_heading(img, images)
        if heading is None or not SIDEWAYS_MIN <= angle_delta(float(angle), heading) <= SIDEWAYS_MAX:
            continue
        captured = datetime.fromtimestamp(int(img["captured_at"]) / 1000, tz=UTC)
        if oldest is not None and captured < oldest:
            continue
        out.append(Photo(str(img["id"]), captured, round(dist, 1), float(angle) % 360, round(delta, 1)))
    return out


def _same_shot(a: Photo, b: Photo) -> bool:
    """Frames from one pass, seconds apart, pointing the same way: the second adds nothing."""
    return (abs((a.captured_at - b.captured_at).total_seconds()) < SAME_SHOT_S
            and angle_delta(a.compass_angle, b.compass_angle) < SAME_SHOT_DEG)


def choose(photos: list[Photo]) -> list[Photo]:
    """Facing within +-FACING_PREFERRED first, then newest, then nearest; at most MAX_PHOTOS, no repeats."""
    ranked = sorted(photos, key=lambda p: (p.facing_delta > FACING_PREFERRED, -p.captured_at.timestamp(),
                                           p.distance_m))
    picked: list[Photo] = []
    for p in ranked:
        if len(picked) < MAX_PHOTOS and not any(_same_shot(p, q) for q in picked):
            picked.append(p)
    return picked


class Mapillary:
    def __init__(self, token: str, client: httpx.Client | None = None) -> None:
        self._http = client or httpx.Client(timeout=30.0)
        self._headers = {"Authorization": f"OAuth {token}"}

    def images_near(self, lat: float, lng: float) -> list[dict[str, Any]]:
        params: dict[str, str | int] = {"bbox": bbox(lat, lng, SEARCH_M), "fields": FIELDS, "limit": LIMIT}
        for attempt in range(1, MAX_ATTEMPTS + 1):
            resp = self._http.get(GRAPH_IMAGES, params=params, headers=self._headers)
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < MAX_ATTEMPTS:
                time.sleep(2**attempt)
                continue
            resp.raise_for_status()
            data = resp.json().get("data", [])
            return list(data) if isinstance(data, list) else []
        return []


class Recorded:
    """Answers saved by `photos --record-dir`, replayed by point; a point with no file was not queried.

    Centers that share an address share a point, and each saved answer for it is a partial sample,
    so the replay is every distinct image seen at that point.
    """

    def __init__(self, directory: Path) -> None:
        self._by_point: dict[tuple[float, float], dict[str, dict[str, Any]]] = {}
        for path in sorted(directory.glob("*.json")):
            rec = json.loads(path.read_text())
            seen = self._by_point.setdefault((round(rec["lat"], 7), round(rec["lng"], 7)), {})
            for img in rec["data"]:
                seen.setdefault(str(img["id"]), img)

    def images_near(self, lat: float, lng: float) -> list[dict[str, Any]]:
        try:
            return list(self._by_point[(round(lat, 7), round(lng, 7))].values())
        except KeyError:
            raise httpx.HTTPError(f"no recorded answer at {lat:.5f},{lng:.5f}") from None


REPLACE = """
delete from core.daycare_photos where operation_id = %(op)s and not verified
  and not (image_id = any(%(keep)s::text[]))
"""
UPSERT = """
insert into core.daycare_photos (operation_id, image_id, captured_at, distance_m, compass_angle)
values (%s, %s, %s, %s, %s)
on conflict (operation_id, image_id) do update set captured_at = excluded.captured_at,
  distance_m = excluded.distance_m, compass_angle = excluded.compass_angle
"""


def fill(
    conn: Conn, api: Mapillary | Recorded, record_dir: Path | None = None, dry_run: bool = False
) -> dict[str, Any]:
    """Query every target, keep the best photos, and report coverage. Commits per center.

    Centers at the same point (one address, several permits) share one query, so they show the same photos.

    A dry run queries and selects exactly the same way but writes nothing, so coverage can be
    measured on a database that has no core.daycare_photos yet.
    """
    targets = conn.execute(TARGETS).fetchall()
    now = datetime.now(UTC)
    counts: dict[str, Any] = {"photos_targets": len(targets), "photos_queried": 0, "photos_failed": 0,
                              "photos_seen": 0, "photos_kept": 0, "photos_centers_with_photo": 0}
    answers: dict[tuple[float, float], list[dict[str, Any]]] = {}
    for op, lat, lng, issued in targets:
        key = (round(lat, 7), round(lng, 7))
        try:
            images = answers[key] if key in answers else answers.setdefault(key, api.images_near(lat, lng))
        except httpx.HTTPError as exc:
            counts["photos_failed"] += 1
            log.warning("photos.request_failed", operation_id=op, error=type(exc).__name__)
            continue
        counts["photos_queried"] += 1
        counts["photos_seen"] += len(images)
        if record_dir is not None:
            record_dir.mkdir(parents=True, exist_ok=True)
            (record_dir / f"{op}.json").write_text(json.dumps(
                {"operation_id": op, "lat": lat, "lng": lng, "bbox": bbox(lat, lng, SEARCH_M), "data": images},
                indent=1))
        kept = choose(candidates(images, lat, lng, not_before(issued, now)))
        counts["photos_kept"] += len(kept)
        counts["photos_centers_with_photo"] += bool(kept)
        if dry_run:
            continue
        with conn.transaction():
            conn.execute(REPLACE, {"op": op, "keep": [p.image_id for p in kept]})
            if kept:
                conn.cursor().executemany(UPSERT, [(op, p.image_id, p.captured_at, p.distance_m, p.compass_angle)
                                                   for p in kept])
    queried = counts["photos_queried"]
    counts["photos_coverage_pct"] = round(100 * counts["photos_centers_with_photo"] / queried, 1) if queried else None
    log.info("photos.done", dry_run=dry_run, **counts)
    return counts


VERIFIED_CSV = Path(__file__).resolve().parents[2] / "data" / "verified_photos.csv"
VERIFIED_COLUMNS = ("operation_id", "image_id", "captured_at", "creator", "sequence_id", "distance_m",
                    "compass_angle", "reviewed_at", "shows")

LOAD_VERIFIED = """
insert into core.daycare_photos (operation_id, image_id, captured_at, distance_m, compass_angle, creator,
                                 verified, verified_at)
values (%s, %s, %s, %s, %s, %s, true, %s)
on conflict (operation_id, image_id) do update set captured_at = excluded.captured_at,
  distance_m = excluded.distance_m, compass_angle = excluded.compass_angle, creator = excluded.creator,
  verified = true, verified_at = excluded.verified_at
"""
UNVERIFY = """
update core.daycare_photos set verified = false, verified_at = null
where verified and not ((operation_id, image_id) in (select * from unnest(%s::bigint[], %s::text[])))
"""


def read_verified(path: Path = VERIFIED_CSV) -> list[dict[str, str]]:
    """The reviewed list: every row is one photo a person checked shows that daycare's building."""
    import csv

    with path.open(newline="") as f:
        rows = list(csv.DictReader(f))
    for i, r in enumerate(rows, start=2):
        if tuple(r) != VERIFIED_COLUMNS or not all(r[c].strip() for c in VERIFIED_COLUMNS if c != "creator"):
            raise ValueError(f"{path.name} line {i}: expected every column of {VERIFIED_COLUMNS} filled")
    return rows


def load_verified(conn: Conn, path: Path = VERIFIED_CSV) -> dict[str, Any]:
    """Make the reviewed list the only photos marked verified. No API call; safe to run every day."""
    rows = read_verified(path)
    with conn.transaction():
        conn.cursor().executemany(LOAD_VERIFIED, [
            (int(r["operation_id"]), r["image_id"], r["captured_at"], float(r["distance_m"]),
             float(r["compass_angle"]) % 360, r["creator"] or None, r["reviewed_at"]) for r in rows])
        conn.execute(UNVERIFY, ([int(r["operation_id"]) for r in rows], [r["image_id"] for r in rows]))
    centers = {r["operation_id"] for r in rows}
    two = sum(1 for c in centers if sum(r["operation_id"] == c for r in rows) >= 2)
    counts = {"photos_verified": len(rows), "photos_verified_centers": len(centers), "photos_two_centers": two}
    log.info("photos.loaded", **counts)
    return counts


def token_from_env() -> str | None:
    return os.environ.get("MAPILLARY_TOKEN") or None


COVERAGE_BY_CITY = f"""
select initcap(d.city) as city, count(*) as centers,
       count(*) filter (where exists (select 1 from core.daycare_photos p where p.operation_id = d.operation_id))
         as with_photo
from ({TARGETS}) t join core.daycares d using (operation_id)
group by 1 order by 2 desc
"""


def coverage(conn: Conn) -> dict[str, Any]:
    """Share of TX-04 target centers with at least one stored photo, overall and by city."""
    rows = conn.execute(COVERAGE_BY_CITY).fetchall()
    total = sum(r[1] for r in rows)
    with_photo = sum(r[2] for r in rows)
    return {"targets": total, "with_photo": with_photo,
            "coverage_pct": round(100 * with_photo / total, 1) if total else None,
            "by_city": [{"city": r[0], "centers": r[1], "with_photo": r[2]} for r in rows]}
