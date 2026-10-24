"""Texas Congressional District 4 (119th Congress) boundary.

The polygon in ``data/tx04_cd119.geojson`` is the official Census TIGER CD119 boundary for GEOID
4804, fetched at full resolution by ``scripts/fetch_district.py`` (source URL, layer, vintage and
fetch time are in the file's properties). It is lon/lat (EPSG:4326).

Membership in the database is decided by PostGIS against ``geo.districts``. The pure-Python
``contains`` here is for tests and for checks run outside the database.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import psycopg

DISTRICT_ID = "TX-04"
DISTRICT_NAME = "Texas Congressional District 4 (119th Congress)"
CONGRESS = 119
DEFAULT_GEOJSON = Path(__file__).resolve().parents[2] / "data" / "tx04_cd119.geojson"

# Counties the CD119 polygon covers, from the Census TIGERweb BAS 2026 county layer
# (spatialRel Contains / Overlaps against the polygon; counties that only share a border are left out).
# Only a flagged fallback (district_basis = 'county') for a daycare with no coordinates:
# a daycare in a PARTIAL county may be outside the district.
TX04_COUNTIES_WHOLE: frozenset[str] = frozenset(
    {"DELTA", "FANNIN", "GRAYSON", "HOPKINS", "LAMAR", "RAINS", "ROCKWALL"}
)
TX04_COUNTIES_PARTIAL: frozenset[str] = frozenset({"BOWIE", "COLLIN", "DENTON", "HUNT", "RED RIVER"})
TX04_COUNTIES: frozenset[str] = TX04_COUNTIES_WHOLE | TX04_COUNTIES_PARTIAL

Ring = Sequence[Sequence[float]]
Polygon = Sequence[Ring]


def load_geojson(path: Path = DEFAULT_GEOJSON) -> dict[str, Any]:
    """Load the district Feature (geometry is a MultiPolygon, properties carry the provenance)."""
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return data


def _polygons(geom: dict[str, Any]) -> list[Polygon]:
    if geom.get("type") == "Feature":
        geom = geom["geometry"]
    gtype = geom.get("type")
    if gtype == "MultiPolygon":
        return list(geom["coordinates"])
    if gtype == "Polygon":
        return [geom["coordinates"]]
    raise ValueError(f"expected Polygon or MultiPolygon, got {gtype!r}")


def _in_ring(lon: float, lat: float, ring: Ring) -> bool:
    """Even-odd ray cast (ray toward +lon). Works whether or not the ring repeats its first point."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def contains(lon: float, lat: float, geom: dict[str, Any]) -> bool:
    """True if (lon, lat) is inside the Polygon/MultiPolygon (or Feature wrapping one).

    A point is inside a polygon when it is inside the outer ring and in none of its holes.
    Points exactly on an edge are not guaranteed either way; the database (ST_Covers) is the
    authority for membership.
    """
    for poly in _polygons(geom):
        if not poly:
            continue
        outer, holes = poly[0], poly[1:]
        if _in_ring(lon, lat, outer) and not any(_in_ring(lon, lat, h) for h in holes):
            return True
    return False


def bbox(geom: dict[str, Any]) -> tuple[float, float, float, float]:
    """(min_lon, min_lat, max_lon, max_lat) over every vertex."""
    xs: list[float] = []
    ys: list[float] = []
    for poly in _polygons(geom):
        for ring in poly:
            for pt in ring:
                xs.append(pt[0])
                ys.append(pt[1])
    return min(xs), min(ys), max(xs), max(ys)


def upsert_district(conn: psycopg.Connection[Any], path: Path = DEFAULT_GEOJSON) -> None:
    """Write the TX-04 polygon into geo.districts (insert or replace). The caller commits."""
    feature = load_geojson(path)
    props = feature.get("properties", {})
    source = (
        f"{props.get('source_url', '')} | {props.get('vintage', '')} | fetched {props.get('fetched_at', '')}"
    )
    with conn.cursor() as cur:
        cur.execute(
            # PostGIS lives in the "extensions" schema (see the geo migration), so qualify it.
            "insert into geo.districts (id, name, congress, source, geom) "
            "values (%s, %s, %s, %s, "
            "extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(%s))::extensions.geography) "
            "on conflict (id) do update set "
            "name = excluded.name, congress = excluded.congress, source = excluded.source, "
            "geom = excluded.geom, loaded_at = now()",
            (DISTRICT_ID, DISTRICT_NAME, CONGRESS, source, json.dumps(feature["geometry"])),
        )
