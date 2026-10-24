"""Capture small, real fixtures from the live data.texas.gov datasets.

Picks a deterministic set of real district-area daycares and saves their operation rows
(JSON, as the API returns them), every activity and violation for them (CSV, as the API
returns them), plus raw recorded responses used by the extract tests. Nothing is edited.

    .venv/bin/python scripts/capture_fixtures.py
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import httpx

BASE = "https://data.texas.gov/resource/"
OUT = Path(__file__).resolve().parent.parent / "fixtures"
COUNTIES = "('COLLIN','GRAYSON','LAMAR','HUNT','ROCKWALL','FANNIN')"
TYPES = "('Licensed Center','Licensed Child-Care Home','Listed Family Home','Registered Child-Care Home')"


def get(http: httpx.Client, ds: str, fmt: str, params: dict[str, str]) -> httpx.Response:
    r = http.get(f"{BASE}{ds}.{fmt}", params=params)
    r.raise_for_status()
    return r


def main() -> None:
    OUT.mkdir(exist_ok=True)
    with httpx.Client(timeout=120) as http:
        # Real daycares with recent state findings: the busiest in each county, by violation count.
        ops = get(http, "bc5r-88dy", "json", {
            "$select": "*, :updated_at",
            "$where": f"county in {COUNTIES} AND operation_type in {TYPES} AND operation_status='Y'",
            "$order": "operation_id", "$limit": "5000",
        }).json()
        by_county: dict[str, list[dict[str, object]]] = {}
        for o in ops:
            by_county.setdefault(str(o["county"]), []).append(o)
        ids = [str(o["operation_id"]) for o in ops]
        counts = {
            r["operation_id"]: int(r["n"])
            for r in get(http, "tqgd-mf4x", "json", {
                "$select": "operation_id, count(*) as n", "$group": "operation_id",
                "$where": f"operation_id in ({','.join(repr(i) for i in ids)})", "$limit": "5000",
            }).json()
        }
        picked: list[dict[str, object]] = []
        for county in sorted(by_county):
            rows = sorted(by_county[county], key=lambda o: (-counts.get(str(o["operation_id"]), 0),
                                                            str(o["operation_id"])))
            picked += rows[:2]
        # Plus a real daycare with coordinates in the state data and one with none.
        with_geo = [o for o in ops if isinstance(o.get("location_address_geo"), dict)
                    and "latitude" in o["location_address_geo"]]
        picked += [o for o in with_geo[:1] if o not in picked]
        pick_ids = sorted({str(o["operation_id"]) for o in picked})
        where = f"operation_id in ({','.join(repr(i) for i in pick_ids)})"
        (OUT / "operations.json").write_text(json.dumps(
            [o for o in ops if str(o["operation_id"]) in pick_ids], indent=1) + "\n")
        acts = get(http, "m5q4-3y3d", "csv", {"$where": where, "$order": ":id", "$limit": "50000"}).text
        viols = get(http, "tqgd-mf4x", "csv", {"$where": where, "$order": ":id", "$limit": "50000"}).text
        (OUT / "activities.csv").write_text(acts)
        (OUT / "violations.csv").write_text(viols)
        # Raw recorded responses for the extract tests.
        rec = OUT / "recorded"
        rec.mkdir(exist_ok=True)
        (rec / "violations_count.json").write_text(
            get(http, "tqgd-mf4x", "json", {"$select": "count(*) as n", "$where": where}).text)
        (rec / "operations_page.json").write_text(get(http, "bc5r-88dy", "json", {
            "$select": "*, :updated_at", "$where": where, "$order": ":id", "$limit": "3", "$offset": "0",
        }).text)
        (rec / "error_400.json").write_text(http.get(
            f"{BASE}bc5r-88dy.json", params={"$select": ":updated_at, *"}).text)
    n_a = len(list(csv.DictReader(io.StringIO(acts))))
    n_v = len(list(csv.DictReader(io.StringIO(viols))))
    print(f"captured {len(pick_ids)} operations, {n_a} activities, {n_v} violations -> {OUT}")


if __name__ == "__main__":
    main()
