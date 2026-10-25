"""Stage 5c: street-level photos from Mapillary for licensed centers in TX-04.

Only active Licensed Centers whose point is an exact Census match and inside the district get a
query; home daycares and approximate points never do (daycare_record also refuses to show photos
for them). For each center one Graph API call lists the images in a box of +-RADIUS_M around the
point. An image is kept when it lies within RADIUS_M, is not a panorama (a flat crop of an
equirectangular image reads as broken), and its camera points at the daycare within +-FACING_MAX.
Up to MAX_PHOTOS are kept: those facing within +-FACING_PREFERRED first, then newest, then nearest.
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
FIELDS = "id,captured_at,computed_geometry,geometry,compass_angle,computed_compass_angle,is_pano"
RADIUS_M = 50.0
MAX_PHOTOS = 3
FACING_MAX = 60.0
FACING_PREFERRED = 45.0
MAX_AGE_YEARS = 6
MAX_ATTEMPTS = 4
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


def candidates(
    images: Iterable[dict[str, Any]], lat: float, lng: float, oldest: datetime | None = None
) -> list[Photo]:
    """Images that show the daycare as it is: close enough, flat, facing it, and not older than `oldest`."""
    out: list[Photo] = []
    for img in images:
        geom = img.get("computed_geometry") or img.get("geometry") or {}
        coords = geom.get("coordinates") if isinstance(geom, dict) else None
        angle = img.get("computed_compass_angle", img.get("compass_angle"))
        if img.get("is_pano") or not coords or angle is None or img.get("captured_at") is None:
            continue
        ilng, ilat = float(coords[0]), float(coords[1])
        dist = distance_m(ilat, ilng, lat, lng)
        if dist > RADIUS_M:
            continue
        delta = angle_delta(float(angle), bearing(ilat, ilng, lat, lng))
        if delta > FACING_MAX:
            continue
        captured = datetime.fromtimestamp(int(img["captured_at"]) / 1000, tz=UTC)
        if oldest is not None and captured < oldest:
            continue
        out.append(Photo(str(img["id"]), captured, round(dist, 1), float(angle) % 360, round(delta, 1)))
    return out


def choose(photos: list[Photo]) -> list[Photo]:
    """Facing within +-FACING_PREFERRED first, then newest, then nearest; at most MAX_PHOTOS."""
    ranked = sorted(photos, key=lambda p: (p.facing_delta > FACING_PREFERRED, -p.captured_at.timestamp(),
                                           p.distance_m))
    return ranked[:MAX_PHOTOS]


class Mapillary:
    def __init__(self, token: str, client: httpx.Client | None = None) -> None:
        self._http = client or httpx.Client(timeout=30.0)
        self._headers = {"Authorization": f"OAuth {token}"}

    def images_near(self, lat: float, lng: float) -> list[dict[str, Any]]:
        params: dict[str, str | int] = {"bbox": bbox(lat, lng), "fields": FIELDS, "limit": 100}
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
    """Answers saved by `photos --record-dir`, replayed by operation_id; a center with no file was not queried."""

    def __init__(self, directory: Path) -> None:
        self._by_point: dict[tuple[float, float], list[dict[str, Any]]] = {}
        for path in directory.glob("*.json"):
            rec = json.loads(path.read_text())
            self._by_point[(round(rec["lat"], 7), round(rec["lng"], 7))] = list(rec["data"])

    def images_near(self, lat: float, lng: float) -> list[dict[str, Any]]:
        try:
            return self._by_point[(round(lat, 7), round(lng, 7))]
        except KeyError:
            raise httpx.HTTPError(f"no recorded answer at {lat:.5f},{lng:.5f}") from None


REPLACE = """
delete from core.daycare_photos where operation_id = %(op)s and not (image_id = any(%(keep)s::text[]))
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

    A dry run queries and selects exactly the same way but writes nothing, so coverage can be
    measured on a database that has no core.daycare_photos yet.
    """
    targets = conn.execute(TARGETS).fetchall()
    now = datetime.now(UTC)
    counts: dict[str, Any] = {"photos_targets": len(targets), "photos_queried": 0, "photos_failed": 0,
                              "photos_seen": 0, "photos_kept": 0, "photos_centers_with_photo": 0}
    for op, lat, lng, issued in targets:
        try:
            images = api.images_near(lat, lng)
        except httpx.HTTPError as exc:
            counts["photos_failed"] += 1
            log.warning("photos.request_failed", operation_id=op, error=type(exc).__name__)
            continue
        counts["photos_queried"] += 1
        counts["photos_seen"] += len(images)
        if record_dir is not None:
            record_dir.mkdir(parents=True, exist_ok=True)
            (record_dir / f"{op}.json").write_text(json.dumps(
                {"operation_id": op, "lat": lat, "lng": lng, "bbox": bbox(lat, lng), "data": images}, indent=1))
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
