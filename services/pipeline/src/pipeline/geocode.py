"""Stage 5a: Census geocoding for daycares the state published without coordinates.

Pending rows (no geom, no geocode_source, a geocode_address) go to the U.S. Census Geocoder
batch endpoint in chunks. Only a "Match" (Exact or Non_Exact) is written; a Tie or No_Match
never is. Matches land in a temp table and reach core.daycares in one UPDATE that skips any
row whose geocode_address changed while the request was out.

An optional JSON cache (geocode_address -> last Census answer) survives database resets:
cached matches are applied without a request, and a cached Tie/No_Match is not re-sent for
NEGATIVE_TTL. District membership is recomputed by load.assign_district, which main() calls.
"""

from __future__ import annotations

import csv
import io
import json
import os
import time
from collections import Counter
from collections.abc import Callable, Collection, Iterable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import structlog

from pipeline.config import connect
from pipeline.load import Conn

log = structlog.get_logger()

BATCH_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
FORM = {"benchmark": "Public_AR_Current", "returntype": "locations"}
CHUNK = 2000  # the endpoint takes up to 10,000; smaller chunks keep each request short
TIMEOUT = 300.0
MAX_ATTEMPTS = 4
NEGATIVE_TTL = timedelta(days=7)
DEFAULT_CACHE = Path(__file__).resolve().parents[2] / ".cache" / "geocode_cache.json"

PENDING = """
select operation_id, geocode_address from core.daycares
where geom is null and geocode_source is null and geocode_address is not null
  and (geocode_attempted_at is null or geocode_attempted_at < now() - interval '7 days')
order by coalesce(county = any(%(priority)s), false) desc, coalesce(operation_status = 'Y', false) desc,
         operation_id
limit %(limit)s
"""

APPLY = """
update core.daycares d
set geom = extensions.st_setsrid(extensions.st_makepoint(t.lon, t.lat), 4326)::extensions.geography,
    geocode_source = 'census'
from t_geocode t
where d.operation_id = t.operation_id and d.geocode_address = t.geocode_address
  and d.geom is null and d.geocode_source is null
"""

Entry = dict[str, Any]  # {"match", "exactness", "lon", "lat", "matched_address", "at"}


class GeocodeError(RuntimeError):
    pass


def split_address(addr: str) -> tuple[str, str, str, str]:
    """"<street>, <city>, TX <zip5>" -> (street, city, state, zip). Anything else goes in street."""
    parts = addr.rsplit(", ", 2)
    if len(parts) != 3:
        return addr, "", "", ""
    state, _, zip5 = parts[2].partition(" ")
    return parts[0], parts[1], state, zip5


def build_csv(rows: Iterable[tuple[int, str]]) -> str:
    """Batch input: Unique ID, Street address, City, State, ZIP. No header."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    for oid, addr in rows:
        w.writerow([oid, *split_address(addr)])
    return buf.getvalue()


def parse_response(text: str, sent: Collection[int]) -> dict[int, Entry]:
    """Batch output -> {operation_id: entry}. Coordinates come back as "lon,lat".

    A "Match" without a usable coordinate is treated as No_Match. Rows that were not sent are ignored.
    """
    now = datetime.now(UTC).isoformat(timespec="seconds")
    out: dict[int, Entry] = {}
    for rec in csv.reader(io.StringIO(text)):
        if not rec or not rec[0].strip().isdigit() or int(rec[0]) not in sent:
            continue
        status = rec[2] if len(rec) > 2 else "No_Match"
        entry: Entry = {"match": "Tie" if status == "Tie" else "No_Match", "at": now}
        if status == "Match" and len(rec) > 5 and rec[5].count(",") == 1:
            lon, lat = (float(v) for v in rec[5].split(","))
            entry = {"match": "Match", "exactness": rec[3], "lon": lon, "lat": lat,
                     "matched_address": rec[4], "at": now}
        out[int(rec[0])] = entry
    return out


def post_batch(http: httpx.Client, body: str, sleep: Callable[[float], None] = time.sleep) -> str:
    """POST one chunk, retrying timeouts, transport errors, 429 and 5xx with backoff."""
    err = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            r = http.post(BATCH_URL, data=FORM, files={"addressFile": ("addresses.csv", body, "text/csv")},
                          timeout=TIMEOUT)
            if r.status_code == 200:
                return r.text
            if r.status_code < 500 and r.status_code != 429:
                raise GeocodeError(f"HTTP {r.status_code}: {r.text[:200]}")
            err = f"HTTP {r.status_code}"
        except httpx.TransportError as e:  # includes timeouts
            err = repr(e)
        log.warning("geocode_retry", attempt=attempt, error=err)
        if attempt < MAX_ATTEMPTS:
            sleep(min(60.0, 5.0 * 2 ** (attempt - 1)))
    raise GeocodeError(f"gave up after {MAX_ATTEMPTS} attempts: {err}")


def _fresh_negative(entry: Entry, now: datetime) -> bool:
    return entry.get("match") != "Match" and now - datetime.fromisoformat(entry["at"]) < NEGATIVE_TTL


def _save(path: Path, cache: dict[str, Entry]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, sort_keys=True))
    tmp.replace(path)


def geocode_pending(
    conn: Conn,
    http: httpx.Client | None = None,
    limit: int | None = None,
    priority_counties: Collection[str] = (),
    cache_path: Path | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, int]:
    """Geocode pending daycares (priority counties first, then active). The caller commits."""
    pending = conn.execute(PENDING, {"priority": sorted(priority_counties), "limit": limit}).fetchall()
    cache: dict[str, Entry] = json.loads(cache_path.read_text()) if cache_path and cache_path.exists() else {}
    now = datetime.now(UTC)
    known = {oid: cache[a] for oid, a in pending if a in cache and (cache[a]["match"] == "Match"
                                                                      or _fresh_negative(cache[a], now))}
    to_send = [(int(oid), str(a)) for oid, a in pending if oid not in known]
    n: Counter[str] = Counter(geocode_pending=len(pending), geocode_sent=len(to_send),
                              geocode_cached=sum(e["match"] == "Match" for e in known.values()),
                              geocode_skipped_recent=sum(e["match"] != "Match" for e in known.values()))
    results: dict[int, Entry] = {oid: e for oid, e in known.items() if e["match"] == "Match"}
    attempted: list[int] = []  # answered by Census (match or not); unmatched rows wait 7 days
    client = http or httpx.Client()
    try:
        for i in range(0, len(to_send), CHUNK):
            chunk = dict(to_send[i:i + CHUNK])
            started = time.monotonic()
            try:
                got = parse_response(post_batch(client, build_csv(chunk.items()), sleep), chunk.keys())
            except GeocodeError as exc:
                log.error("geocode_chunk_failed", offset=i, rows=len(chunk), error=str(exc))
                n["geocode_failed"] += len(chunk)
                continue
            n["geocode_no_match"] += len(chunk) - len(got)  # sent but not returned
            attempted += chunk.keys()
            for oid, e in got.items():
                kind = {"Match": str(e.get("exactness", "")).lower(), "Tie": "tie"}.get(e["match"], "no_match")
                n[f"geocode_{kind}"] += 1
                cache[chunk[oid]] = e
                if e["match"] == "Match":
                    results[oid] = e
            if cache_path:
                _save(cache_path, cache)
            log.info("geocode_chunk", offset=i, rows=len(chunk), seconds=round(time.monotonic() - started, 1),
                     matched=sum(e["match"] == "Match" for e in got.values()))
    finally:
        if http is None:
            client.close()
    n["geocode_matched"] = n["geocode_exact"] + n["geocode_non_exact"]
    addr = dict(pending)
    conn.execute("create temp table t_geocode (operation_id bigint primary key, geocode_address text, "
                 "lon float8, lat float8) on commit drop")
    with conn.cursor() as cur:
        with cur.copy("copy t_geocode from stdin") as cp:
            for oid, e in results.items():
                cp.write_row((oid, addr[oid], e["lon"], e["lat"]))
        cur.execute(APPLY)
        n["geocode_written"] = cur.rowcount
        cur.execute("update core.daycares set geocode_attempted_at = now() where operation_id = any(%s)",
                    (attempted,))
    conn.execute("drop table t_geocode")
    keys = ("geocode_pending", "geocode_cached", "geocode_skipped_recent", "geocode_sent", "geocode_matched",
            "geocode_exact", "geocode_non_exact", "geocode_tie", "geocode_no_match", "geocode_failed",
            "geocode_written")
    return {k: n[k] for k in keys}


BY_COUNTY = """
select county, count(*) from core.daycares
where operation_status = 'Y' and in_district and district_basis = 'point'
group by county order by count(*) desc, county
"""


def cache_path_from_env() -> Path | None:
    """GEOCODE_CACHE overrides the cache file; set it empty to disable (CI has no cache)."""
    cache_env = os.environ.get("GEOCODE_CACHE")
    return DEFAULT_CACHE if cache_env is None else (Path(cache_env) if cache_env else None)


def main() -> None:
    """python -m pipeline.geocode. GEOCODE_CACHE overrides the cache file; set it empty to disable."""
    from pipeline.district import TX04_COUNTIES
    from pipeline.load import assign_district

    cache_path = cache_path_from_env()
    started = time.monotonic()
    with connect(os.environ["DATABASE_URL"]) as conn:
        counts = geocode_pending(conn, priority_counties=TX04_COUNTIES, cache_path=cache_path)
        counts |= assign_district(conn)
        if conn.execute("select to_regproc('core.refresh_aggregates')").fetchone() != (None,):
            conn.execute("select core.refresh_aggregates()")
        conn.commit()
        rows = conn.execute(BY_COUNTY).fetchall()
    for k, v in counts.items():
        print(f"{k:28} {v:>7,}")
    print(f"\nactive daycares in TX-04 by geocoded point, by county ({time.monotonic() - started:.0f}s):")
    for county, c in rows:
        print(f"  {county or '(none)':12} {c:>6,}")
    print(f"  {'TOTAL':12} {sum(c for _, c in rows):>6,}")


if __name__ == "__main__":
    main()
