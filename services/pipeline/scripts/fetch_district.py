"""Fetch the official TX-04 boundary (119th Congress, GEOID 4804) from Census TIGERweb.

Writes services/pipeline/data/tx04_cd119.geojson: one GeoJSON Feature whose geometry is a
lon/lat (EPSG:4326) MultiPolygon at full TIGER resolution (no maxAllowableOffset, no
geometryPrecision), with the source URL, layer, vintage and fetch time in its properties.

It also asks TIGERweb which Texas counties lie wholly inside the district (spatialRel Contains:
the query geometry contains the county) and which it only partly covers (spatialRel Overlaps).
Counties that merely share a boundary line with the district are neither, so they are excluded.
Both lists go into the properties.

Re-runnable:
    .venv/bin/python scripts/fetch_district.py --raw-dir /some/new/empty/dir

The raw server responses are saved to --raw-dir (must be new or empty) before any parsing.
Do not point this at the 120th Congress layer: the app uses CD119 (Rep. Fallon's current seat).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

TIGERWEB = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb"
CD_SERVICE = f"{TIGERWEB}/Legislative/MapServer"
CD_LAYER_ID = 4  # "119th Congressional Districts", group "BAS 2026" (January 1, 2026 vintage)
COUNTY_SERVICE = f"{TIGERWEB}/State_County/MapServer"
COUNTY_LAYER_ID = 1  # "Counties", January 1, 2026 vintage (same BAS 2026 release)
GEOID = "4804"
EXPECTED_LAYER_NAME = "119th Congressional Districts"

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "data" / "tx04_cd119.geojson"


def _fresh_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    if any(path.iterdir()):
        raise SystemExit(f"--raw-dir must be new or empty: {path}")
    return path


def _get_json(client: httpx.Client, url: str, params: dict[str, str], save_to: Path) -> Any:
    resp = client.get(url, params=params)
    resp.raise_for_status()
    save_to.write_bytes(resp.content)
    return json.loads(save_to.read_text(encoding="utf-8"))


def _post_json(client: httpx.Client, url: str, data: dict[str, str], save_to: Path) -> Any:
    resp = client.post(url, data=data)
    resp.raise_for_status()
    save_to.write_bytes(resp.content)
    return json.loads(save_to.read_text(encoding="utf-8"))


def _check_layer(meta: dict[str, Any], expected_name: str) -> str:
    name = str(meta.get("name", ""))
    if name != expected_name:
        raise SystemExit(f"unexpected layer name {name!r}, wanted {expected_name!r}")
    return str(meta.get("description", ""))


def _as_multipolygon(geometry: dict[str, Any]) -> list[list[list[list[float]]]]:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if gtype == "Polygon":
        return [coords]  # type: ignore[list-item]
    if gtype == "MultiPolygon":
        return coords  # type: ignore[return-value]
    raise SystemExit(f"unexpected geometry type {gtype!r}")


def _to_esri_rings(multi: list[list[list[list[float]]]]) -> list[list[list[float]]]:
    # Esri rings: outer rings clockwise, holes counter-clockwise (the reverse of GeoJSON RFC 7946).
    rings: list[list[list[float]]] = []
    for poly in multi:
        for i, ring in enumerate(poly):
            area2 = sum(
                (ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1]) for k in range(len(ring) - 1)
            )
            ccw = area2 > 0
            want_ccw = i > 0
            rings.append(ring if ccw == want_ccw else list(reversed(ring)))
    return rings


def _county_names(fc: dict[str, Any]) -> list[str]:
    feats = fc.get("features", [])
    if fc.get("exceededTransferLimit"):
        raise SystemExit("county query exceeded transfer limit")
    return sorted(str(f["properties"]["BASENAME"]).upper() for f in feats)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    ap.add_argument("--raw-dir", type=Path, required=True, help="new or empty dir for raw responses")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args(argv)
    raw = _fresh_dir(args.raw_dir)

    fetched_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    cd_layer_url = f"{CD_SERVICE}/{CD_LAYER_ID}"
    cd_query_url = f"{cd_layer_url}/query"
    cd_params = {
        "where": f"GEOID='{GEOID}'",
        "outFields": "*",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    county_layer_url = f"{COUNTY_SERVICE}/{COUNTY_LAYER_ID}"

    with httpx.Client(timeout=180.0, headers={"User-Agent": "daycare-watch-pipeline/0.1"}) as client:
        cd_meta = _get_json(client, cd_layer_url, {"f": "json"}, raw / "cd_layer_meta.json")
        vintage = _check_layer(cd_meta, EXPECTED_LAYER_NAME)
        fc = _get_json(client, cd_query_url, cd_params, raw / "cd_query.geojson")
        feats = fc.get("features", [])
        if len(feats) != 1:
            raise SystemExit(f"expected exactly 1 feature for GEOID {GEOID}, got {len(feats)}")
        src = feats[0]
        src_props: dict[str, Any] = src.get("properties", {})
        if str(src_props.get("GEOID")) != GEOID:
            raise SystemExit(f"GEOID mismatch: {src_props.get('GEOID')!r}")
        multi = _as_multipolygon(src["geometry"])

        county_meta = _get_json(client, county_layer_url, {"f": "json"}, raw / "county_layer_meta.json")
        county_vintage = _check_layer(county_meta, "Counties")
        esri_geom = json.dumps({"rings": _to_esri_rings(multi), "spatialReference": {"wkid": 4326}})
        counties: dict[str, list[str]] = {}
        for rel in ("esriSpatialRelContains", "esriSpatialRelOverlaps"):
            res = _post_json(
                client,
                f"{county_layer_url}/query",
                {
                    "where": "STATE='48'",
                    "geometry": esri_geom,
                    "geometryType": "esriGeometryPolygon",
                    "inSR": "4326",
                    "spatialRel": rel,
                    "outFields": "BASENAME,GEOID",
                    "returnGeometry": "false",
                    "f": "geojson",
                },
                raw / f"counties_{rel}.geojson",
            )
            counties[rel] = _county_names(res)

    n_vertices = sum(len(ring) for poly in multi for ring in poly)
    feature = {
        "type": "Feature",
        "id": "TX-04",
        "properties": {
            "district_id": "TX-04",
            "name": "Texas Congressional District 4 (119th Congress)",
            "geoid": GEOID,
            "congress": 119,
            "source": "U.S. Census Bureau TIGERweb",
            "source_url": cd_query_url,
            "source_query": cd_params,
            "layer": f"TIGERweb/Legislative/MapServer/{CD_LAYER_ID} ({EXPECTED_LAYER_NAME})",
            "vintage": vintage,
            "generalization": "none (no maxAllowableOffset, no geometryPrecision)",
            "fetched_at": fetched_at,
            "crs": "EPSG:4326 (lon, lat)",
            "vertex_count": n_vertices,
            "census_attributes": {
                k: src_props.get(k)
                for k in ("GEOID", "NAME", "BASENAME", "CDSESSN", "AREALAND", "AREAWATER", "POP100", "MTFCC")
            },
            "counties_source": f"{county_layer_url}/query (Counties; {county_vintage})",
            "counties_whole": counties["esriSpatialRelContains"],
            "counties_partial": counties["esriSpatialRelOverlaps"],
        },
        "geometry": {"type": "MultiPolygon", "coordinates": multi},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(feature, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {args.out} ({n_vertices} vertices, {len(multi)} polygon(s))")
    print(f"counties whole:   {counties['esriSpatialRelContains']}")
    print(f"counties partial: {counties['esriSpatialRelOverlaps']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
