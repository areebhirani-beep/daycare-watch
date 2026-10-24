from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from pipeline import district
from pipeline.district import (
    DISTRICT_ID,
    TX04_COUNTIES,
    TX04_COUNTIES_PARTIAL,
    TX04_COUNTIES_WHOLE,
    bbox,
    contains,
    load_geojson,
)

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "district_points.json"


@pytest.fixture(scope="module")
def feature() -> dict[str, Any]:
    return load_geojson()


def _points() -> list[dict[str, Any]]:
    data: dict[str, Any] = json.loads(FIXTURE.read_text(encoding="utf-8"))
    pts: list[dict[str, Any]] = data["points"]
    return pts


POINTS = _points()


@pytest.mark.parametrize("p", POINTS, ids=[f"{p['city']}-{p['operation_id']}" for p in POINTS])
def test_real_operations_classify(feature: dict[str, Any], p: dict[str, Any]) -> None:
    assert contains(p["lng"], p["lat"], feature) is p["expected_inside"]


def test_fixture_covers_required_cases() -> None:
    inside = Counter(p["city"] for p in POINTS if p["expected_inside"])
    outside = Counter(p["city"] for p in POINTS if not p["expected_inside"])
    assert inside["FRISCO"] >= 2
    assert inside["SHERMAN"] >= 2
    assert inside["PARIS"] >= 2
    assert outside["DALLAS"] >= 2
    assert all(p["coord_source"] in {"state", "census"} for p in POINTS)


@pytest.mark.parametrize(
    ("name", "lon", "lat"),
    [
        ("Houston", -95.3698, 29.7604),
        ("El Paso", -106.4850, 31.7619),
        ("Austin", -97.7431, 30.2672),
        ("Amarillo", -101.8313, 35.2220),
        ("Downtown Dallas", -96.7970, 32.7767),
        ("Texarkana AR", -94.0377, 33.4418),
    ],
)
def test_far_away_is_outside(feature: dict[str, Any], name: str, lon: float, lat: float) -> None:
    assert not contains(lon, lat, feature), name


@settings(max_examples=60, deadline=None)
@given(
    lon=st.floats(min_value=-106.6, max_value=-93.5),
    lat=st.floats(min_value=25.8, max_value=36.5),
)
def test_outside_bbox_is_outside(feature: dict[str, Any], lon: float, lat: float) -> None:
    x0, y0, x1, y1 = bbox(feature)
    if x0 <= lon <= x1 and y0 <= lat <= y1:
        return
    assert not contains(lon, lat, feature)


def test_geometry_is_valid_closed_multipolygon(feature: dict[str, Any]) -> None:
    assert feature["type"] == "Feature"
    geom = feature["geometry"]
    assert geom["type"] == "MultiPolygon"
    assert len(geom["coordinates"]) >= 1
    for poly in geom["coordinates"]:
        assert len(poly) >= 1
        for ring in poly:
            assert len(ring) >= 4
            assert ring[0] == ring[-1]
            for pt in ring:
                assert len(pt) == 2
                assert -180 <= pt[0] <= 180 and -90 <= pt[1] <= 90


def test_bounds_are_northeast_texas(feature: dict[str, Any]) -> None:
    x0, y0, x1, y1 = bbox(feature)
    # lon/lat order (not lat/lon) and inside the Dallas-to-Texarkana corner of Texas.
    assert -97.5 < x0 < x1 < -93.9
    assert 32.5 < y0 < y1 < 34.0


def test_provenance_is_cd119_tx04(feature: dict[str, Any]) -> None:
    props = feature["properties"]
    assert props["district_id"] == DISTRICT_ID == "TX-04"
    assert props["geoid"] == "4804"
    assert props["congress"] == 119
    assert props["census_attributes"]["CDSESSN"] == "119"
    assert "TIGERweb/Legislative/MapServer/4/query" in props["source_url"]
    assert "119th Congressional Districts" in props["vintage"]
    assert props["vertex_count"] == sum(len(r) for p in feature["geometry"]["coordinates"] for r in p)


def test_counties_match_polygon_file(feature: dict[str, Any]) -> None:
    props = feature["properties"]
    assert frozenset(props["counties_whole"]) == TX04_COUNTIES_WHOLE
    assert frozenset(props["counties_partial"]) == TX04_COUNTIES_PARTIAL
    assert TX04_COUNTIES == TX04_COUNTIES_WHOLE | TX04_COUNTIES_PARTIAL
    assert not TX04_COUNTIES_WHOLE & TX04_COUNTIES_PARTIAL
    assert "DALLAS" not in TX04_COUNTIES


def test_holes_and_multipolygon() -> None:
    square = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]
    hole = [[4.0, 4.0], [4.0, 6.0], [6.0, 6.0], [6.0, 4.0], [4.0, 4.0]]
    far = [[20.0, 20.0], [22.0, 20.0], [22.0, 22.0], [20.0, 22.0], [20.0, 20.0]]
    geom = {"type": "MultiPolygon", "coordinates": [[square, hole], [far]]}
    assert contains(1.0, 1.0, geom)
    assert not contains(5.0, 5.0, geom)  # in the hole
    assert contains(21.0, 21.0, geom)  # second polygon
    assert not contains(15.0, 15.0, geom)
    assert contains(1.0, 1.0, {"type": "Polygon", "coordinates": [square, hole]})
    with pytest.raises(ValueError):
        contains(0.0, 0.0, {"type": "Point", "coordinates": [0.0, 0.0]})


@pytest.mark.db
@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="DATABASE_URL not set")
def test_upsert_district_roundtrip() -> None:
    import psycopg

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        district.upsert_district(conn)
        district.upsert_district(conn)  # idempotent
        with conn.cursor() as cur:
            cur.execute("select count(*) from geo.districts where id = %s", (DISTRICT_ID,))
            row = cur.fetchone()
            assert row is not None and row[0] == 1
            for p in POINTS:
                cur.execute(
                    "select extensions.ST_Covers(geom, extensions.ST_SetSRID("
                    "extensions.ST_MakePoint(%s, %s), 4326)::extensions.geography) "
                    "from geo.districts where id = %s",
                    (p["lng"], p["lat"], DISTRICT_ID),
                )
                got = cur.fetchone()
                assert got is not None and got[0] is p["expected_inside"], p["operation_id"]
