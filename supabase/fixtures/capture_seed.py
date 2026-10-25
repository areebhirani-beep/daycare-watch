"""Capture real records from data.texas.gov into supabase/seed.sql.

Usage: python3 supabase/fixtures/capture_seed.py

Pulls in-scope daycares that carry state coordinates near McKinney/Sherman, with every
activity and violation from the last 5 years, and writes them as SQL inserts. Nothing is
invented: plain summaries are left null and every category is 'other' until the pipeline
classifies them. district membership is left unset (no polygon in the seed).
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

BASE = "https://data.texas.gov/resource"
OUT = Path(__file__).resolve().parents[1] / "seed.sql"

# Few operations carry state coordinates, so the seed mixes: every geocoded licensed
# center within 90 km of TX-04's middle, geocoded family homes in district counties,
# and licensed centers in McKinney/Sherman without coordinates (findable by search only).
NEAR = "within_circle(location_address_geo,33.4,-96.4,90000)"
SELECTIONS = (
    (f"{NEAR} AND operation_type='Licensed Center'", 20),
    (f"{NEAR} AND operation_type='Listed Family Home' AND county in('COLLIN','GRAYSON','FANNIN','ROCKWALL','HUNT')", 8),
    ("city in('MCKINNEY','SHERMAN') AND operation_type='Licensed Center' AND location_address_geo IS NULL", 6),
)
SINCE = f"{date.today().year - 5}-01-01T00:00:00"
STANDARD = re.compile(r"^\s*(\S+)\s+-\s+(.*)$", re.S)
# Marker for a home daycare's street (not an address), same rule as the API (docs/PRIVACY.md).
WITHHELD = "withheld for privacy"


def soda(dataset: str, **params: str) -> list[dict]:
    url = f"{BASE}/{dataset}.json?" + urllib.parse.urlencode({f"${k}": v for k, v in params.items()})
    with urllib.request.urlopen(url, timeout=60) as resp:
        return json.load(resp)


def lit(v: object) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, list):
        return "array[" + ",".join(lit(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def yn(v: str | None) -> bool | None:
    if v is None:
        return None
    return v.strip().upper() in ("Y", "YES")


def day(v: str | None) -> str | None:
    return v[:10] if v else None


def split(v: str | None) -> list[str]:
    return [p.strip() for p in v.split(",") if p.strip()] if v else []


def num(v: str | None) -> int | None:
    return int(v) if v not in (None, "") else None


def coord(v: str, home: bool) -> float:
    return round(float(v), 2) if home else float(v)


def main() -> None:
    ops: dict[str, dict] = {}
    for where, n in SELECTIONS:
        rows = soda("bc5r-88dy", where=f"{where} AND operation_status='Y'", order="operation_id", limit=str(n))
        ops.update({r["operation_id"]: r for r in rows})

    ids = ",".join(str(int(i)) for i in ops)
    acts = soda("m5q4-3y3d", where=f"operation_id in({ids}) AND activity_date >= '{SINCE}'", limit="50000")
    act_by_id = {a["activity_id"]: a for a in acts}
    viols = soda("tqgd-mf4x", where=f"operation_id in({ids})", limit="50000")
    viols = [v for v in viols if v["activity_id"] in act_by_id]

    out = [
        "-- Real records captured from data.texas.gov (bc5r-88dy, m5q4-3y3d, tqgd-mf4x)",
        f"-- on {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC by supabase/fixtures/capture_seed.py.",
        "-- plain is null and category is 'other' until the pipeline classifies them.",
        "-- Upserts are skipped on conflict so a pipeline load always wins.",
        f"-- Home daycares are private residences: their street is replaced by '{WITHHELD}' and their point",
        "-- rounded to 2 decimals (about 1 km), so this public file never republishes where a home is.",
        "",
    ]
    for o in ops.values():
        geo = o.get("location_address_geo") or {}
        home = o["operation_type"] != "Licensed Center"
        point = (
            f"extensions.st_setsrid(extensions.st_makepoint({coord(geo['longitude'], home)}, {coord(geo['latitude'], home)}), 4326)::extensions.geography"
            if geo.get("latitude")
            else "null"
        )
        cols = {
            "operation_id": num(o["operation_id"]),
            "operation_number": o.get("operation_number"),
            "name": o["operation_name"],
            "operation_type": o["operation_type"],
            "address": WITHHELD if home else o.get("location_address"),
            "address_line": WITHHELD if home else o.get("address_line"),
            "city": o.get("city"),
            "county": o.get("county"),
            "zip": (o.get("zipcode") or "")[:5] or None,
            "phone": o.get("phone_number"),
            "capacity": num(o.get("total_capacity")),
            "ages": split(o.get("licensed_to_serve_ages")),
            "hours": o.get("hours_of_operation"),
            "days": split(o.get("days_of_operation")),
            "programs": split(o.get("programs_provided")),
            "accepts_subsidies": yn(o.get("accepts_child_care_subsidies")),
            "issuance_type": o.get("type_of_issuance"),
            "issuance_date": day(o.get("issuance_date")),
            "operation_status": o.get("operation_status"),
            "conditions_on_permit": yn(o.get("conditions_on_permit")),
            "corrective_action": yn(o.get("corrective_action")),
            "adverse_action": yn(o.get("adverse_action")),
            "temporarily_closed": yn(o.get("temporarily_closed")),
            "deficiency_high": num(o.get("deficiency_high")),
            "deficiency_medium_high": num(o.get("deficiency_medium_high")),
            "deficiency_medium": num(o.get("deficiency_medium")),
            "deficiency_medium_low": num(o.get("deficiency_medium_low")),
            "deficiency_low": num(o.get("deficiency_low")),
            "total_inspections": num(o.get("total_inspections")),
            "total_assessments": num(o.get("total_assessments")),
            "total_reports": num(o.get("total_reports")),
            "total_self_reports": num(o.get("total_self_reports")),
            "geocode_source": "state" if geo.get("latitude") else None,
        }
        out.append(
            f"insert into core.daycares ({', '.join(cols)}, geom) values ("
            f"{', '.join(lit(v) for v in cols.values())}, {point}) on conflict do nothing;"
        )
    for a in acts:
        cols = {
            "activity_id": num(a["activity_id"]),
            "operation_id": num(a["operation_id"]),
            "activity_at": a["activity_date"].replace("T", " ")[:19],
            "activity_type": a["activity_type"],
            "violation_found": a["violation_found"],
            "self_report": yn(a.get("self_report")),
        }
        out.append(
            f"insert into core.inspections ({', '.join(cols)}) values ("
            f"{', '.join(lit(v) for v in cols.values())}) on conflict do nothing;"
        )
    for v in viols:
        m = STANDARD.match(v["standard_number_description"])
        act = act_by_id[v["activity_id"]]
        cols = {
            "non_compliance_id": num(v["non_compliance_id"]),
            "activity_id": num(v["activity_id"]),
            "section_id": num(v.get("section_id")),
            "operation_id": num(v["operation_id"]),
            "activity_date": day(act["activity_date"]),
            "standard_code": m.group(1) if m else None,
            "standard_title": m.group(2).strip() if m else v["standard_number_description"],
            "risk_level": v["standard_risk_level"],
            "narrative": v.get("narrative"),
            "corrected_at_inspection": bool(yn(v.get("corrected_at_inspection"))),
            "corrected_date": day(v.get("corrected_date")),
            "verified_date": day(v.get("date_correction_verified")),
            "technical_assistance": yn(v.get("technical_assistance_given")),
            "via_investigation": act["activity_type"] == "REPORT",
        }
        out.append(
            f"insert into core.violations ({', '.join(cols)}) values ("
            f"{', '.join(lit(v) for v in cols.values())}) on conflict do nothing;"
        )
    OUT.write_text("\n".join(out) + "\n")
    print(f"wrote {OUT}: {len(ops)} daycares, {len(acts)} activities, {len(viols)} violations")


if __name__ == "__main__":
    main()
