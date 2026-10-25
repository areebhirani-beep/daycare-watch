# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "matplotlib==3.11.2",
#   "psycopg[binary]==3.3.6",
# ]
# ///
"""Build the README data figures from the database.

    uv run scripts/figures.py

Reads DATABASE_URL (default: the local Supabase stack). For every figure it writes
docs/figures/<name>-light.svg, docs/figures/<name>-dark.svg and docs/figures/<name>.csv
(the plotted numbers, the table view of the chart), then rewrites docs/figures/README.md
from the same SQL constants and query results, so the doc and the figures cannot drift.

Every number on a figure comes from a query below. Nothing is typed in by hand.
Set FIGURES_PNG_DIR to also write PNG previews somewhere outside the repo.
"""

from __future__ import annotations

import csv
import datetime as dt
import json
import os
import pathlib
from dataclasses import dataclass

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402
import psycopg  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402
from matplotlib.patches import PathPatch, Polygon  # noqa: E402
from matplotlib.path import Path  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "figures"
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:55322/postgres"
)
PNG_DIR = os.environ.get("FIGURES_PNG_DIR")

# ---------------------------------------------------------------------------
# SQL. docs/figures/README.md prints these constants verbatim.
# ---------------------------------------------------------------------------

# The newest successful sync that loaded data (dry runs load nothing). Its date, in
# Texas time, is the "pulled" date on every figure; its stage counts feed the funnel.
SQL_SOURCE_RUN = """
select (finished_at at time zone 'America/Chicago')::date as pulled_on,
       stage_counts,
       join_rate
from ops.sync_runs
where ok
  and finished_at is not null
  and mode not like '%dry-run%'
order by finished_at desc
limit 1
"""

# The state's visit file holds about five years: visits dated before (pulled_on - 5 years)
# are only partly present, so time series start at the first whole month after that date
# and end at the last whole month before the newest finding. The last two columns check
# whose findings the file holds: every finding row should belong to a row of the
# operations file, which lists (almost) only active operations.
SQL_WINDOW = """
with run as (
  select run_id, (finished_at at time zone 'America/Chicago')::date as pulled_on
  from ops.sync_runs
  where ok and finished_at is not null and mode not like '%dry-run%'
  order by finished_at desc
  limit 1
)
select (date_trunc('month', pulled_on - interval '5 years') + interval '1 month')::date as first_month,
       (date_trunc('month', (select max(activity_date) from core.violations))
          - interval '1 month')::date as last_month,
       (select min(activity_date) from core.inspections) as oldest_visit,
       (select max(activity_date) from core.violations) as newest_finding,
       (pulled_on - interval '5 years')::date as five_years_before_pull,
       (select count(*) from core.inspections
          where activity_date >= pulled_on - interval '5 years'
            and activity_date <  pulled_on - interval '5 years' + interval '7 days')
         as visits_first_week_inside,
       (select count(*) from core.inspections
          where activity_date >= pulled_on - interval '5 years' - interval '7 days'
            and activity_date <  pulled_on - interval '5 years')
         as visits_last_week_before,
       (select count(*) from staging.violations v
          where v.run_id = run.run_id
            and not exists (select 1 from staging.operations o
                              where o.run_id = v.run_id
                                and o.raw->>'operation_id' = v.operation_id))
         as findings_without_operation,
       (select count(*) from staging.operations o
          where o.run_id = run.run_id and o.raw->>'operation_status' <> 'Y')
         as operations_not_active,
       (select count(*) from staging.operations o where o.run_id = run.run_id)
         as operations_rows
from run
"""

# Whether the inspection-to-posting lag has been measured yet (it needs findings that
# first appear after the backfill).
SQL_LAG_STATUS = """
select count(*) as ok_runs,
       count(lag_median_days) as runs_with_lag,
       coalesce(sum((stage_counts->>'lag_sample_violations')::int), 0) as lag_sample_violations
from ops.sync_runs
where ok
"""

# (a) TX-04 map. The district outline, simplified to 100 m, in Texas Centric Albers
# (EPSG:3083, metres) so distances are true on the page.
SQL_MAP_DISTRICT = """
select name,
       ST_AsGeoJSON(ST_ForcePolygonCCW(ST_Simplify(ST_Transform(geom::geometry, 3083), 100)), 0) as outline
from geo.districts
where id = 'TX-04'
"""

# Active Licensed Centers whose map point is inside TX-04, one dot each,
# coordinates rounded to 100 m.
SQL_MAP_CENTERS = """
select round(ST_X(ST_Transform(geom::geometry, 3083))::numeric, -2)::float8 as x,
       round(ST_Y(ST_Transform(geom::geometry, 3083))::numeric, -2)::float8 as y
from core.daycares
where operation_type = 'Licensed Center'
  and operation_status = 'Y'
  and in_district
  and district_basis = 'point'
order by x, y
"""

# Active home daycares inside TX-04, never as points: a count per hexagon with
# 5 km sides (about 65 km2 each). Each home falls in exactly one hexagon.
SQL_MAP_HOME_HEXES = """
with homes as (
  select operation_id, ST_Transform(geom::geometry, 3083) as p
  from core.daycares
  where operation_type <> 'Licensed Center'
    and operation_status = 'Y'
    and in_district
    and district_basis = 'point'
),
cell as (
  select h.operation_id, x.i, x.j, x.geom
  from homes h
  cross join lateral (
    select i, j, geom from ST_HexagonGrid(5000, h.p) order by i, j limit 1
  ) x
)
select i, j, ST_AsGeoJSON(geom, 0) as hex, count(*) as homes
from cell
group by i, j, geom
order by i, j
"""

# Active daycares tied to a TX-04 county but with no map point: never placed, never drawn.
SQL_MAP_UNPLACED = """
select count(*) filter (where operation_type = 'Licensed Center') as centers,
       count(*) filter (where operation_type <> 'Licensed Center') as homes
from core.daycares
where operation_status = 'Y'
  and in_district
  and district_basis = 'county'
"""

# (b) Findings per whole month, statewide, by the state's risk level for the rule.
SQL_FINDINGS_BY_MONTH = """
select date_trunc('month', activity_date)::date as month,
       risk_level::text as risk_level,
       count(*) as findings
from core.violations
where activity_date >= %(first_month)s
  and activity_date <  (%(last_month)s::date + interval '1 month')
group by 1, 2
order by 1, 2
"""

# Findings outside the whole-month range, so every loaded finding is accounted for.
SQL_FINDINGS_OUTSIDE = """
select count(*) filter (where activity_date <  %(first_month)s) as before_first,
       count(*) filter (where activity_date >= (%(last_month)s::date + interval '1 month')) as after_last,
       count(*) as all_findings
from core.violations
"""

# (c) Share of findings per rule category: statewide vs daycares inside TX-04 by map point.
SQL_CATEGORY_SHARES = """
select v.category::text as category,
       count(*) as statewide,
       count(*) filter (where d.in_district and d.district_basis = 'point') as tx04
from core.violations v
join core.daycares d using (operation_id)
group by 1
order by 2 desc
"""

# (d) For findings in the 24 months before the pull: did the state record checking the
# fix, was it fixed during the visit, or neither (yet)? The three are disjoint in the data;
# the query counts the overlap so the script can prove it.
SQL_FIX_FOLLOW_THROUGH = """
with run as (
  select (finished_at at time zone 'America/Chicago')::date as pulled_on
  from ops.sync_runs
  where ok and finished_at is not null and mode not like '%dry-run%'
  order by finished_at desc
  limit 1
)
select v.risk_level::text as risk_level,
       count(*) as findings,
       count(*) filter (where v.verified_date is not null) as state_checked,
       count(*) filter (where v.verified_date is null and v.corrected_at_inspection) as fixed_during_visit,
       count(*) filter (where v.verified_date is null and not v.corrected_at_inspection) as neither_yet,
       count(*) filter (where v.verified_date is not null and v.corrected_at_inspection) as both,
       count(*) filter (where v.verified_date > run.pulled_on) as checked_after_pull,
       count(*) filter (where v.verified_date < v.activity_date) as checked_before_visit,
       min(v.activity_date) as first_date,
       max(v.activity_date) as last_date
from core.violations v, run
where v.activity_date >= run.pulled_on - interval '24 months'
group by v.risk_level
order by v.risk_level
"""

# (e) Citations of rule 746.2905(1), "May Not Force Child to Sleep", per whole quarter. 746.2905(2)
# (restrictive devices) is a different requirement under the same rule number and is left out.
SQL_NAP_RULE_BY_QUARTER = """
select date_trunc('quarter', v.activity_date)::date as quarter,
       count(*) as statewide,
       count(*) filter (where d.in_district and d.district_basis = 'point') as tx04,
       count(*) filter (where d.operation_type = 'Licensed Center') as at_centers
from core.violations v
join core.daycares d using (operation_id)
where v.standard_code = '746.2905(1)'
group by 1
order by 1
"""

# The rule titles as the state words them, for the subtitle.
SQL_NAP_RULE_TITLES = """
select standard_code, standard_title, count(*) as findings
from core.violations
where standard_code = '746.2905(1)'
group by 1, 2
order by 1
"""

# (f) Data funnel: what the pipeline counted in the newest run, checked against core.
SQL_FUNNEL_CORE = """
select (select count(*) from core.daycares) as daycares_in_scope,
       (select count(*) from core.daycares where geom is not null) as daycares_with_point,
       (select count(*) from core.daycares
          where operation_status = 'Y' and in_district and district_basis = 'point')
         as daycares_tx04_point,
       (select count(*) from core.inspections) as visits_in_scope,
       (select count(*) from core.violations) as findings_in_scope,
       (select count(*) from core.violations v
          where exists (select 1 from core.inspections i where i.activity_id = v.activity_id))
         as findings_joined_to_visit
"""

# ---------------------------------------------------------------------------
# Theme. The app's own palette: ink for the mark that matters, warm grays for context.
# Risk level is ordinal, so it is one ramp from ink (High) to light gray (Low), never hues.
# Yellow stays out: in the app it only means watching and alerts.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Theme:
    name: str
    surface: str
    ink: str
    ink2: str
    muted: str
    grid: str
    axis: str
    neutral: str  # de-emphasis mark ("rest of Texas", "statewide", "neither yet")
    series: tuple[str, ...]
    seq: tuple[str, ...]  # sequential gray, low -> high count
    risk: tuple[str, ...]  # RISK_ORDER, High first


LIGHT = Theme(
    name="light",
    surface="#ffffff",
    ink="#0b0b0b",
    ink2="#52514e",
    muted="#6e6d68",
    grid="#e6e5df",
    axis="#c3c2b7",
    neutral="#bdbcb4",
    series=("#0b0b0b", "#0b0b0b", "#76756f"),
    seq=("#cfcec6", "#a09f97", "#6e6d68", "#2b2a28"),
    risk=("#0b0b0b", "#46453f", "#76756f", "#a8a79f", "#d6d5ce"),
)
DARK = Theme(
    name="dark",
    surface="#0d1117",
    ink="#f0efec",
    ink2="#c3c2b7",
    muted="#8b8a84",
    grid="#21262d",
    axis="#3d444d",
    neutral="#4f4e4a",
    series=("#f0efec", "#f0efec", "#8b8a84"),
    seq=("#3d3c39", "#6b6a65", "#a3a29b", "#e6e5df"),
    risk=("#f0efec", "#c3c2b7", "#8b8a84", "#5f5e59", "#3d3c39"),
)

RISK_ORDER = ["High", "Medium High", "Medium", "Medium Low", "Low"]
CATEGORY_LABEL = {  # same words as the app (apps/mobile/src/lib/format.ts)
    "supervision": "Supervision",
    "background_checks": "Background checks",
    "staff_ratio": "Staff-to-child ratio",
    "safety_hazards": "Safety hazards",
    "health_medication": "Health & medication",
    "discipline": "Discipline",
    "parent_communication": "Parent communication",
    "paperwork_admin": "Paperwork",
    "other": "Other",
}

W, H, DPI = 12.0, 7.0, 100  # 1200 x 700 at 100 dpi

plt.rcParams.update(
    {
        "svg.fonttype": "none",
        "svg.hashsalt": "daycare-watch-figures",
        "font.family": "sans-serif",
        "font.sans-serif": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
        "font.size": 13,
        "axes.linewidth": 0.8,
        "path.simplify": True,
    }
)


def fmt(n: int | float) -> str:
    return f"{n:,.0f}"


def pct(part: float, whole: float, digits: int = 1) -> str:
    return f"{100 * part / whole:.{digits}f}%"


def long_date(d: dt.date) -> str:
    return f"{d:%b} {d.day}, {d.year}"


def month_label(d: dt.date) -> str:
    return f"{d:%b} {d.year}"


def quarter_label(d: dt.date) -> str:
    return f"Q{(d.month - 1) // 3 + 1} {d.year}"


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------


def new_figure(t: Theme, h: float = H):
    fig = plt.figure(figsize=(W, h), dpi=DPI)
    fig.patch.set_facecolor(t.surface)
    return fig


def header(fig, t: Theme, title: str, subtitle: str):
    h = fig.get_figheight()
    fig.text(0.04, 1 - 0.455 / h, title, fontsize=21, fontweight="bold", color=t.ink,
             va="baseline")
    fig.text(0.04, 1 - 0.805 / h, subtitle, fontsize=13.5, color=t.ink2, va="baseline")


def footer(fig, t: Theme, pulled: dt.date, notes: list[str]):
    h = fig.get_figheight()
    y = 0.245 / h
    fig.text(
        0.04, y,
        f"Source: Texas HHSC via data.texas.gov, pulled {long_date(pulled)}",
        fontsize=11.5, color=t.muted, va="baseline",
    )
    for line in reversed(notes):
        y += 0.231 / h
        fig.text(0.04, y, line, fontsize=11.5, color=t.ink2, va="baseline")


def style_axes(ax, t: Theme, grid_axis: str = "y"):
    ax.set_facecolor(t.surface)
    for side in ("top", "right", "left", "bottom"):
        ax.spines[side].set_visible(False)
    ax.tick_params(colors=t.ink2, labelsize=12, length=0, pad=6)
    if grid_axis:
        ax.grid(axis=grid_axis, color=t.grid, linewidth=0.8, linestyle="-")
        ax.set_axisbelow(True)


def baseline(ax, t: Theme, horizontal: bool = True, at: float = 0):
    if horizontal:
        ax.axhline(at, color=t.axis, linewidth=1, zorder=3)
    else:
        ax.axvline(at, color=t.axis, linewidth=1, zorder=3)


def text_on(fill: str) -> str:
    """Black or white label, whichever reads on this fill."""
    r, g, b = (int(fill[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return "#0b0b0b" if 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 else "#ffffff"


def legend_row(fig, t: Theme, items: list[tuple[str, str]], x: float, y: float,
               marker: str | list[str] = "s", gap: float = 0.03):
    """A one-row legend of (colour, label): a swatch, dot or ring, then ink text."""
    renderer = fig.canvas.get_renderer()
    sw_h = 0.133 / fig.get_figheight()  # 13 px swatch at any figure height
    markers = marker if isinstance(marker, list) else [marker] * len(items)
    for (color, label), mk in zip(items, markers):
        if mk in ("o", "ring"):
            fig.add_artist(Line2D(
                [x + 0.0055], [y + sw_h / 2], transform=fig.transFigure, marker="o",
                markersize=9, linestyle="none",
                markerfacecolor=color if mk == "o" else "none",
                markeredgecolor=color, markeredgewidth=2 if mk == "ring" else 0,
            ))
        else:
            fig.patches.append(plt.Rectangle((x, y), 0.011, sw_h, transform=fig.transFigure,
                                             color=color, figure=fig))
        txt = fig.text(x + 0.017, y + 0.003 * 7 / fig.get_figheight(), label, fontsize=12.5,
                       color=t.ink2, va="bottom")
        bb = txt.get_window_extent(renderer=renderer)
        x += 0.017 + bb.width / fig.bbox.width + gap
    return x


def rounded_bar(ax, start: float, end: float, lo: float, hi: float, color: str,
                vertical: bool, radius_px: float = 4.0, zorder: float = 2,
                edge: str | None = None, edge_w: float = 0):
    """A bar from `start` to `end` along the value axis, `lo`..`hi` across it, with
    rounded corners at the data end only (square at the baseline)."""
    if end == start:
        return
    fig = ax.figure
    bbox = ax.get_window_extent(renderer=fig.canvas.get_renderer())
    x0, x1 = ax.get_xlim()
    y0, y1 = ax.get_ylim()
    px_x = bbox.width / abs(x1 - x0)
    px_y = bbox.height / abs(y1 - y0)
    along_px, across_px = (px_y, px_x) if vertical else (px_x, px_y)
    ra = min(radius_px / along_px, abs(end - start) / 2)
    rc = min(radius_px / across_px, abs(hi - lo) / 2)
    k = 0.5523
    s = 1 if end > start else -1

    def P(a, c):
        return (c, a) if vertical else (a, c)

    e = end
    verts = [
        P(start, lo),
        P(e - s * ra, lo),
        P(e - s * ra + s * k * ra, lo), P(e, lo + rc - k * rc), P(e, lo + rc),
        P(e, hi - rc),
        P(e, hi - rc + k * rc), P(e - s * ra + s * k * ra, hi), P(e - s * ra, hi),
        P(start, hi),
        P(start, lo),
    ]
    codes = [Path.MOVETO, Path.LINETO, Path.CURVE4, Path.CURVE4, Path.CURVE4, Path.LINETO,
             Path.CURVE4, Path.CURVE4, Path.CURVE4, Path.LINETO, Path.CLOSEPOLY]
    ax.add_patch(PathPatch(Path(verts, codes), facecolor=color,
                           edgecolor=edge or "none", linewidth=edge_w, zorder=zorder))


def square_bar(ax, start, end, lo, hi, color, vertical, edge=None, edge_w=0.0, zorder=2):
    if end == start:
        return
    if vertical:
        xy = [(lo, start), (hi, start), (hi, end), (lo, end)]
    else:
        xy = [(start, lo), (end, lo), (end, hi), (start, hi)]
    ax.add_patch(Polygon(xy, closed=True, facecolor=color, edgecolor=edge or "none",
                         linewidth=edge_w, zorder=zorder))


def save(fig, name: str, t: Theme):
    path = OUT / f"{name}-{t.name}.svg"
    fig.savefig(path, format="svg", facecolor=t.surface, metadata={"Date": None})
    if PNG_DIR:
        pathlib.Path(PNG_DIR).mkdir(parents=True, exist_ok=True)
        fig.savefig(pathlib.Path(PNG_DIR) / f"{name}-{t.name}.png", format="png",
                    facecolor=t.surface, dpi=DPI)
    plt.close(fig)


def write_csv(name: str, header_row: list[str], rows: list[list]):
    with open(OUT / f"{name}.csv", "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header_row)
        w.writerows(rows)


def nice_ticks(vmax: float, target: int = 5) -> list[float]:
    raw = vmax / target
    mag = 10 ** (len(str(int(raw))) - 1) if raw >= 1 else 1
    for m in (1, 2, 2.5, 5, 10):
        step = m * mag
        if vmax / step <= target:
            break
    top = step * -(-vmax // step)
    n = int(round(top / step))
    return [i * step for i in range(n + 1)]


def compact(v: float) -> str:
    if v >= 1000:
        s = f"{v / 1000:.1f}".rstrip("0").rstrip(".")
        return f"{s}K"
    return f"{v:.0f}"


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------


@dataclass
class Data:
    pulled: dt.date
    stage: dict
    join_rate: float
    window: dict
    district_name: str
    outline: list
    centers: list[tuple[float, float]]
    hexes: list[tuple[list, int]]
    unplaced: dict
    months: list[dt.date]
    by_month: dict[tuple[dt.date, str], int]
    outside: dict
    categories: list[dict]
    fix: list[dict]
    nap: list[dict]
    nap_titles: list[dict]
    funnel: dict
    lag: dict


def rows(conn, sql: str, params: dict | None = None) -> list[dict]:
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def load() -> Data:
    with psycopg.connect(DATABASE_URL) as conn:
        run = rows(conn, SQL_SOURCE_RUN)
        if not run:
            raise SystemExit("ops.sync_runs has no successful run; run the pipeline first")
        run = run[0]
        window = rows(conn, SQL_WINDOW)[0]
        district = rows(conn, SQL_MAP_DISTRICT)
        if len(district) != 1:
            raise SystemExit(f"expected one TX-04 row in geo.districts, found {len(district)}")
        geo = json.loads(district[0]["outline"])
        polys = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
        centers = [(r["x"], r["y"]) for r in rows(conn, SQL_MAP_CENTERS)]
        hexes = [(json.loads(r["hex"])["coordinates"][0], r["homes"])
                 for r in rows(conn, SQL_MAP_HOME_HEXES)]
        unplaced = rows(conn, SQL_MAP_UNPLACED)[0]
        params = {"first_month": window["first_month"], "last_month": window["last_month"]}
        by_month = {}
        for r in rows(conn, SQL_FINDINGS_BY_MONTH, params):
            by_month[(r["month"], r["risk_level"])] = r["findings"]
        outside = rows(conn, SQL_FINDINGS_OUTSIDE, params)[0]
        months = []
        m = window["first_month"]
        while m <= window["last_month"]:
            months.append(m)
            m = (m.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        return Data(
            pulled=run["pulled_on"],
            stage=run["stage_counts"],
            join_rate=float(run["join_rate"]),
            window=window,
            district_name=district[0]["name"],
            outline=polys,
            centers=centers,
            hexes=hexes,
            unplaced=unplaced,
            months=months,
            by_month=by_month,
            outside=outside,
            categories=rows(conn, SQL_CATEGORY_SHARES),
            fix=rows(conn, SQL_FIX_FOLLOW_THROUGH),
            nap=rows(conn, SQL_NAP_RULE_BY_QUARTER),
            nap_titles=rows(conn, SQL_NAP_RULE_TITLES),
            funnel=rows(conn, SQL_FUNNEL_CORE)[0],
            lag=rows(conn, SQL_LAG_STATUS)[0],
        )


# ---------------------------------------------------------------------------
# Figures. Each returns the facts its README entry states.
# ---------------------------------------------------------------------------

HEX_BINS = [(1, 1), (2, 3), (4, 7), (8, None)]  # homes per hexagon, low -> high


def hex_bin(n: int) -> int:
    for i, (lo, hi) in enumerate(HEX_BINS):
        if n >= lo and (hi is None or n <= hi):
            return i
    raise ValueError(n)


def fig_map(d: Data, t: Theme) -> dict:
    n_centers = len(d.centers)
    n_homes = sum(c for _, c in d.hexes)
    tx04_point = d.funnel["daycares_tx04_point"]
    assert n_centers + n_homes == tx04_point, (n_centers, n_homes, tx04_point)
    unplaced = d.unplaced["centers"] + d.unplaced["homes"]

    ring0 = d.hexes[0][0]
    hex_km2 = abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring0, ring0[1:]))) / 2e6
    hh = 6.3  # inches; the district is wide and short
    fig = new_figure(t, hh)
    header(
        fig, t,
        "Active daycares inside Texas congressional district 4",
        f"n = {fmt(tx04_point)} active daycares placed inside TX-04 by map point: "
        f"{fmt(n_centers)} licensed centers, {fmt(n_homes)} home daycares",
    )
    xs = [p[0] for poly in d.outline for ring in poly for p in ring]
    ys = [p[1] for poly in d.outline for ring in poly for p in ring]
    pad = 3000
    xlim = (min(xs) - pad, max(xs) + pad)
    ylim = (min(ys) - pad, max(ys) + pad)
    aspect = (ylim[1] - ylim[0]) / (xlim[1] - xlim[0])
    panel_w = 0.45
    panel_h = panel_w * aspect * W / hh
    top = 1 - 1.5 / hh
    bottom = top - panel_h

    def district_path() -> Path:
        # Rings come exterior-CCW / holes-CW (ST_ForcePolygonCCW), so nonzero fill is right.
        return Path.make_compound_path(*[Path(ring, closed=True) for poly in d.outline
                                         for ring in poly])

    panels = [
        (0.04, f"Licensed centers, one dot each ({fmt(n_centers)})"),
        (0.51, f"Home daycares, count per hexagon with 5 km sides ({fmt(n_homes)})"),
    ]
    axes = []
    for left, label in panels:
        ax = fig.add_axes([left, bottom, panel_w, panel_h])
        ax.set_xlim(*xlim)
        ax.set_ylim(*ylim)
        ax.set_aspect("equal")
        ax.axis("off")
        fig.text(left, top + 0.2 / hh, label, fontsize=13.5, color=t.ink,
                 fontweight="bold", va="baseline")
        ax.add_patch(PathPatch(district_path(), facecolor=t.grid, edgecolor="none", zorder=1))
        ax.add_patch(PathPatch(district_path(), facecolor="none", edgecolor=t.ink2,
                               linewidth=1.1, zorder=4, joinstyle="round"))
        axes.append(ax)

    # Left: centers.
    axes[0].scatter([p[0] for p in d.centers], [p[1] for p in d.centers], s=26,
                    color=t.series[1], edgecolors=t.surface, linewidths=1.0, zorder=5)

    # Right: homes per hexagon, clipped to the district outline.
    ax = axes[1]
    clip = PathPatch(district_path(), transform=ax.transData)
    for ring, count in d.hexes:
        patch = Polygon(ring, closed=True, facecolor=t.seq[hex_bin(count)],
                        edgecolor=t.surface, linewidth=1.0, zorder=3)
        ax.add_patch(patch)
        patch.set_clip_path(clip)

    # Scale bar (50 km) under the left panel.
    sb_ax = axes[0]
    x0 = xlim[0] + 2000
    y0 = ylim[0] - (ylim[1] - ylim[0]) * 0.1
    sb_ax.plot([x0, x0 + 50000], [y0, y0], color=t.ink2, linewidth=1.5, clip_on=False,
               solid_capstyle="butt")
    for xx in (x0, x0 + 50000):
        sb_ax.plot([xx, xx], [y0 - 1500, y0 + 1500], color=t.ink2, linewidth=1.2,
                   clip_on=False)
    sb_ax.text(x0 + 53000, y0, "50 km", color=t.ink2, fontsize=11.5, va="center")
    ly = bottom - 0.42 / hh
    legend_row(fig, t, [(t.series[1], "Licensed center")], 0.25, ly, marker="o")

    # Hex legend under the right panel.
    lx = 0.51
    fig.text(lx, ly + 0.03 / hh, "Homes per hexagon", fontsize=12.5, color=t.ink2,
             va="bottom")
    lx += 0.14
    items = []
    for i, (lo, hi) in enumerate(HEX_BINS):
        lab = f"{lo}" if hi == lo else (f"{lo}+" if hi is None else f"{lo}–{hi}")
        items.append((t.seq[i], lab))
    legend_row(fig, t, items, lx, ly, gap=0.02)

    footer(fig, t, d.pulled, [
        "A daycare is drawn only when its map point is inside the Census boundary of the district "
        "(119th Congress). No street map, no addresses.",
        f"{fmt(unplaced)} more active daycares in TX-04 counties have no map point and are not drawn. "
        "Home daycares are private residences,",
        f"so they appear only as counts per hexagon (about {hex_km2:.0f} km\u00b2 each), clipped to the district.",
    ])
    save(fig, "tx04-map", t)
    hex_centers = []
    for ring, count in d.hexes:
        cx = sum(p[0] for p in ring[:-1]) / len(ring[:-1])
        cy = sum(p[1] for p in ring[:-1]) / len(ring[:-1])
        hex_centers.append([round(cx), round(cy), count])
    write_csv("tx04-map", ["hex_center_x_epsg3083", "hex_center_y_epsg3083", "home_daycares"],
              hex_centers)
    max_hex = max(c for _, c in d.hexes)
    return dict(hex_km2=hex_km2, n=tx04_point, centers=n_centers, homes=n_homes, hexes=len(d.hexes),
                max_hex=max_hex, unplaced=unplaced, district=d.district_name)


def fig_findings_by_month(d: Data, t: Theme) -> dict:
    months = d.months
    totals = [sum(d.by_month.get((m, r), 0) for r in RISK_ORDER) for m in months]
    n = sum(totals)
    first, last = months[0], months[-1]
    fig = new_figure(t)
    header(
        fig, t,
        "Findings per month, statewide, by the state's risk level for the rule",
        f"n = {fmt(n)} findings at Texas daycares, {month_label(first)} to {month_label(last)} "
        f"(whole months only)",
    )
    ax = fig.add_axes([0.075, 0.25, 0.9, 0.53])
    style_axes(ax, t, "y")
    top = nice_ticks(max(totals))
    ax.set_ylim(0, top[-1])
    ax.set_xlim(-0.8, len(months) - 0.2)
    ax.set_yticks(top)
    ax.set_yticklabels([compact(v) for v in top])
    xt = [i for i, m in enumerate(months) if m.month == 1]
    ax.set_xticks(xt)
    ax.set_xticklabels([str(months[i].year) for i in xt])
    width = 0.78
    for i, m in enumerate(months):
        acc = 0
        present = [r for r in RISK_ORDER if d.by_month.get((m, r), 0) > 0]
        for r in RISK_ORDER:
            v = d.by_month.get((m, r), 0)
            if not v:
                continue
            color = t.risk[RISK_ORDER.index(r)]
            if r == present[-1]:
                rounded_bar(ax, acc, acc + v, i - width / 2, i + width / 2, color, True,
                            radius_px=3, edge=t.surface, edge_w=0.9)
            else:
                square_bar(ax, acc, acc + v, i - width / 2, i + width / 2, color, True,
                           edge=t.surface, edge_w=0.9)
            acc += v
    baseline(ax, t)
    legend_row(fig, t, [(t.risk[i], f"{r}") for i, r in enumerate(RISK_ORDER)],
               0.075, 0.815)
    ob = d.outside
    footer(fig, t, d.pulled, [
        "Risk level is the state's own weight for the rule that was cited; it rates the rule, not the daycare. "
        "Stacked bottom to top: High to Low.",
        f"The state's files hold about five years, of daycares on its current list. Left out: "
        f"{fmt(ob['before_first'])} findings dated before {month_label(first)}",
        f"(only partly in the file) and {fmt(ob['after_last'])} in the month in progress. "
        "Recent months can still grow as findings post after the visit.",
    ])
    save(fig, "findings-by-month", t)
    rows_out = [[m.isoformat()] + [d.by_month.get((m, r), 0) for r in RISK_ORDER] + [tot]
                for m, tot in zip(months, totals)]
    write_csv("findings-by-month", ["month"] + RISK_ORDER + ["total"], rows_out)
    by_risk = {r: sum(d.by_month.get((m, r), 0) for m in months) for r in RISK_ORDER}
    return dict(n=n, first=first, last=last, by_risk=by_risk, min_month=min(totals),
                max_month=max(totals), outside=ob,
                median_month=sorted(totals)[len(totals) // 2])


def fig_categories(d: Data, t: Theme) -> dict:
    cats = d.categories  # ordered by statewide count desc
    n_state = sum(c["statewide"] for c in cats)
    n_tx = sum(c["tx04"] for c in cats)
    fig = new_figure(t)
    header(
        fig, t,
        "What the findings were about: statewide vs TX-04",
        f"Share of findings in each rule category. Statewide n = {fmt(n_state)}; "
        f"TX-04 n = {fmt(n_tx)} (daycares inside the district by map point)",
    )
    ax = fig.add_axes([0.22, 0.2, 0.56, 0.6])
    style_axes(ax, t, "x")
    k = len(cats)
    shares_s = [c["statewide"] / n_state * 100 for c in cats]
    shares_t = [c["tx04"] / n_tx * 100 for c in cats]
    vmax = max(shares_s + shares_t)
    ticks = nice_ticks(vmax, 4)
    ax.set_xlim(0, ticks[-1])
    ax.set_xticks(ticks)
    ax.set_xticklabels([f"{v:.0f}%" for v in ticks])
    ax.set_ylim(k - 0.4, -0.6)
    ax.set_yticks(range(k))
    ax.set_yticklabels([CATEGORY_LABEL[c["category"]] for c in cats], fontsize=13, color=t.ink)
    for i, (s, x) in enumerate(zip(shares_s, shares_t)):
        ax.plot([min(s, x), max(s, x)], [i, i], color=t.axis, linewidth=2,
                solid_capstyle="round", zorder=2)
        ax.scatter([s], [i], s=150, facecolors=t.surface, edgecolors=t.neutral, linewidths=2,
                   zorder=3)
        ax.scatter([x], [i], s=60, color=t.series[0], edgecolors=t.surface, linewidths=1.5,
                   zorder=4)
    # Value columns at the right, in ink.
    cx1, cx2 = 0.845, 0.935
    fig.text(cx1, 0.815, "Statewide", fontsize=12, color=t.ink2, ha="right", va="bottom")
    fig.text(cx2, 0.815, "TX-04", fontsize=12, color=t.ink2, ha="right", va="bottom")
    for i, (s, x) in enumerate(zip(shares_s, shares_t)):
        y = ax.transData.transform((0, i))[1] / fig.bbox.height
        fig.text(cx1, y, f"{s:.1f}%", fontsize=12.5, color=t.ink2, ha="right", va="center")
        fig.text(cx2, y, f"{x:.1f}%", fontsize=12.5, color=t.ink, ha="right", va="center")
    legend_row(fig, t, [(t.neutral, "Statewide"), (t.series[0], "TX-04")], 0.22, 0.815,
               marker=["ring", "o"])
    footer(fig, t, d.pulled, [
        "Categories come from fixed rules on the state's rule number and title "
        "(services/pipeline/src/pipeline/classify.py). Rows ordered by statewide share.",
        "All findings in the state's file (about five years). Shares in each column add to 100%.",
    ])
    save(fig, "categories", t)
    write_csv("categories", ["category", "statewide_findings", "statewide_share_pct",
                             "tx04_findings", "tx04_share_pct"],
              [[c["category"], c["statewide"], f"{s:.2f}", c["tx04"], f"{x:.2f}"]
               for c, s, x in zip(cats, shares_s, shares_t)])
    top = cats[0]
    return dict(n_state=n_state, n_tx=n_tx, cats=cats, shares_s=shares_s, shares_t=shares_t,
                top=CATEGORY_LABEL[top["category"]])


def fig_fix(d: Data, t: Theme) -> dict:
    by = {r["risk_level"]: r for r in d.fix}
    assert all(r["both"] == 0 for r in d.fix), "verified and fixed-during-visit overlap"
    total = {k: sum(r[k] for r in d.fix) for k in
             ("findings", "state_checked", "fixed_during_visit", "neither_yet",
              "checked_after_pull", "checked_before_visit")}
    first = min(r["first_date"] for r in d.fix)
    last = max(r["last_date"] for r in d.fix)
    labels = ["All risk levels"] + [r for r in RISK_ORDER if r in by]
    data = [total] + [by[r] for r in RISK_ORDER if r in by]
    keys = [("state_checked", "State recorded checking the fix", t.series[0]),
            ("fixed_during_visit", "Fixed during the visit", t.series[2]),
            ("neither_yet", "Neither on record yet", t.neutral)]

    fig = new_figure(t)
    header(
        fig, t,
        "Fix follow-through on findings from the last 24 months",
        f"n = {fmt(total['findings'])} findings statewide dated {long_date(first)} to "
        f"{long_date(last)}, by the state's risk level for the rule",
    )
    ax = fig.add_axes([0.235, 0.2, 0.7, 0.56])
    style_axes(ax, t, "x")
    ax.set_xlim(0, 100)
    ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_xticklabels(["0%", "25%", "50%", "75%", "100%"])
    k = len(labels)
    ax.set_ylim(k - 0.3, -0.7)
    ax.set_yticks(range(k))
    ax.set_yticklabels([])
    renderer = fig.canvas.get_renderer()
    h = 0.30
    for i, (lab, row) in enumerate(zip(labels, data)):
        y = ax.transData.transform((0, i))[1] / fig.bbox.height
        fig.text(0.04, y + 0.009, lab, fontsize=13, color=t.ink,
                 fontweight="bold" if i == 0 else "normal", va="baseline")
        fig.text(0.04, y - 0.021, f"n = {fmt(row['findings'])}", fontsize=11.5, color=t.ink2,
                 va="baseline")
        acc = 0.0
        segs = [(key, row[key] / row["findings"] * 100, color) for key, _, color in keys]
        nonzero = [s for s in segs if s[1] > 0]
        for j, (key, share, color) in enumerate(segs):
            if share <= 0:
                continue
            if key == nonzero[-1][0]:
                rounded_bar(ax, acc, acc + share, i - h, i + h, color, False,
                            edge=t.surface, edge_w=1.2)
            else:
                square_bar(ax, acc, acc + share, i - h, i + h, color, False,
                           edge=t.surface, edge_w=1.2)
            label = f"{share:.1f}%"
            txt_w = len(label) * 7.5  # px estimate at 12.5 pt, checked below
            seg_px = ax.transData.transform((share, 0))[0] - ax.transData.transform((0, 0))[0]
            if seg_px > txt_w + 16:
                ink = text_on(color)
                ax.text(acc + share / 2, i, label, ha="center", va="center", fontsize=12.5,
                        color=ink, zorder=5)
            acc += share
    baseline(ax, t, horizontal=False)
    legend_row(fig, t, [(c, lab) for _, lab, c in keys], 0.235, 0.81)
    footer(fig, t, d.pulled, [
        "State recorded checking the fix: date_correction_verified is filled. Fixed during the visit: "
        "corrected_at_inspection. The two never overlap.",
        "corrected_date is filled on every finding, some in the future, so it is read as a due date "
        "and not counted. Newer findings have had less time",
        f"for a state check. Counted as the file states: {fmt(total['checked_after_pull'])} check dates "
        f"after the pull date, {fmt(total['checked_before_visit'])} before the visit date.",
    ])
    save(fig, "fix-follow-through", t)
    write_csv("fix-follow-through",
              ["risk_level", "findings", "state_checked", "fixed_during_visit", "neither_yet"],
              [[lab, r["findings"], r["state_checked"], r["fixed_during_visit"], r["neither_yet"]]
               for lab, r in zip(labels, data)])
    return dict(total=total, first=first, last=last, by=by)


def fig_nap(d: Data, t: Theme) -> dict:
    first_q = d.window["first_month"]
    # first whole quarter on or after the first whole month; last whole quarter before the newest finding
    fq = dt.date(first_q.year, ((first_q.month - 1) // 3) * 3 + 1, 1)
    if fq < first_q:
        fq = dt.date(fq.year + (fq.month + 3 > 12), (fq.month + 2) % 12 + 1, 1)
    newest = d.window["newest_finding"]
    lq_start = dt.date(newest.year, ((newest.month - 1) // 3) * 3 + 1, 1)
    quarters = []
    q = fq
    while q < lq_start:
        quarters.append(q)
        q = dt.date(q.year + (q.month + 3 > 12), (q.month + 2) % 12 + 1, 1)
    by_q = {r["quarter"]: r for r in d.nap}
    st = [by_q.get(q, {}).get("statewide", 0) for q in quarters]
    tx = [by_q.get(q, {}).get("tx04", 0) for q in quarters]
    n_state, n_tx = sum(st), sum(tx)
    all_state = sum(r["statewide"] for r in d.nap)
    all_tx = sum(r["tx04"] for r in d.nap)
    titles = {r["standard_code"]: (r["standard_title"], r["findings"]) for r in d.nap_titles}

    rule_names = {title.split(" - ", 1)[0] for title, _ in titles.values()}
    rule_name = " / ".join(sorted(rule_names))
    fig = new_figure(t)
    header(
        fig, t,
        "Citations of the nap rule, 746.2905(1), per quarter",
        f"\"{rule_name}\". n = {fmt(n_state)} citations statewide, "
        f"{quarter_label(quarters[0])} to {quarter_label(quarters[-1])}; {fmt(n_tx)} of them "
        f"at daycares inside TX-04",
    )
    ax = fig.add_axes([0.085, 0.29, 0.875, 0.49])
    style_axes(ax, t, "y")
    ticks = nice_ticks(max(st), 4)
    ax.set_ylim(0, ticks[-1])
    ax.set_yticks(ticks)
    ax.set_yticklabels([f"{v:.0f}" for v in ticks])
    ax.set_xlim(-0.7, len(quarters) - 0.3)
    xt = [i for i, q in enumerate(quarters) if q.month == 1]
    ax.set_xticks(xt)
    ax.set_xticklabels([str(quarters[i].year) for i in xt])
    w = 0.5
    for i, (s, x) in enumerate(zip(st, tx)):
        rest = s - x
        if x:
            if rest:
                square_bar(ax, 0, x, i - w / 2, i + w / 2, t.series[0], True,
                           edge=t.surface, edge_w=1.2)
                rounded_bar(ax, x, s, i - w / 2, i + w / 2, t.neutral, True,
                            edge=t.surface, edge_w=1.2)
            else:
                rounded_bar(ax, 0, x, i - w / 2, i + w / 2, t.series[0], True,
                            edge=t.surface, edge_w=1.2)
        elif rest:
            rounded_bar(ax, 0, rest, i - w / 2, i + w / 2, t.neutral, True,
                        edge=t.surface, edge_w=1.2)
        ax.annotate(f"{s}", xy=(i, s), xytext=(0, 4), textcoords="offset points",
                    ha="center", va="bottom", fontsize=11.5, color=t.ink2)
    baseline(ax, t)
    # The TX-04 count for every quarter, as a row under the axis.
    row_y = -0.15
    ax.text(-0.7, row_y, "TX-04", transform=ax.get_xaxis_transform(), ha="right",
            va="center", fontsize=12, color=t.ink, fontweight="bold")
    for i, x in enumerate(tx):
        ax.text(i, row_y, f"{x}" if x else "–", transform=ax.get_xaxis_transform(),
                ha="center", va="center", fontsize=12, color=t.ink if x else t.muted)
    legend_row(fig, t, [(t.series[0], f"TX-04 ({n_tx})"),
                        (t.neutral, f"Rest of Texas ({n_state - n_tx})")], 0.085, 0.815)
    at_centers = sum(r["at_centers"] for r in d.nap)
    parts = "; ".join(f"{code} \"{title.split(' - ', 1)[-1]}\": {fmt(cnt)}"
                      for code, (title, cnt) in titles.items())
    footer(fig, t, d.pulled, [
        f"Whole quarters only. All {fmt(all_state)} citations in the state's file ({fmt(all_tx)} in TX-04), "
        f"{fmt(at_centers)} of them at Licensed Centers. By subsection:",
        parts + ".",
    ])
    save(fig, "nap-rule", t)
    write_csv("nap-rule", ["quarter_start", "statewide", "tx04"],
              [[q.isoformat(), s, x] for q, s, x in zip(quarters, st, tx)])
    return dict(n_state=n_state, n_tx=n_tx, first=quarters[0], last=quarters[-1],
                all_state=all_state, all_tx=all_tx, titles=titles, at_centers=at_centers,
                peak=max(st), tx_quarters=[(quarter_label(q), x) for q, x in zip(quarters, tx) if x])


def fig_funnel(d: Data, t: Theme) -> dict:
    sc, fc = d.stage, d.funnel
    checks = {
        "daycares_in_scope": (sc["daycares_in_scope"], fc["daycares_in_scope"]),
        "violations_in_scope": (sc["violations_in_scope"], fc["findings_in_scope"]),
        "inspections_upserted": (sc["inspections_upserted"], fc["visits_in_scope"]),
        "in_district_point_active": (sc["in_district_point_active"], fc["daycares_tx04_point"]),
    }
    for k, (a, b) in checks.items():
        assert a == b, f"stage_counts.{k}={a} but core has {b}"
    join_rate = fc["findings_joined_to_visit"] / fc["findings_in_scope"]
    sections = [
        ("Daycares", [
            ("Rows in the state's operations file", sc["extract_operations"]),
            ("Daycares in scope (4 daycare types)", fc["daycares_in_scope"]),
            ("With a map point", fc["daycares_with_point"]),
            ("Active, inside TX-04 by map point", fc["daycares_tx04_point"]),
        ]),
        ("Visits", [
            ("Rows in the state's activities file", sc["extract_activities"]),
            ("Visits at in-scope daycares", fc["visits_in_scope"]),
        ]),
        ("Findings", [
            ("Rows in the state's non-compliance file", sc["extract_violations"]),
            ("Findings at in-scope daycares", fc["findings_in_scope"]),
            ("Joined to their state visit", fc["findings_joined_to_visit"]),
        ]),
    ]
    fig = new_figure(t)
    header(
        fig, t,
        "From the state's files to what the app shows",
        f"Counts from the newest pipeline run; findings joined to their visit: "
        f"{fmt(fc['findings_joined_to_visit'])} of {fmt(fc['findings_in_scope'])} "
        f"(join rate {join_rate:.3f})",
    )
    total_rows = sum(len(s[1]) for s in sections)
    top, bot = 0.82, 0.17
    row_h = (top - bot) / (total_rows + len(sections) * 0.9)
    y = top
    bar_left, bar_w = 0.42, 0.38
    for title, items in sections:
        y -= row_h * 0.75
        fig.text(0.04, y, title, fontsize=13.5, color=t.ink, fontweight="bold", va="center")
        y -= row_h * 0.15
        ax = fig.add_axes([bar_left, y - row_h * len(items), bar_w, row_h * len(items)])
        style_axes(ax, t, "")
        ax.set_xlim(0, items[0][1])
        ax.set_ylim(len(items) - 0.5, -0.5)
        ax.set_xticks([])
        ax.set_yticks([])
        for i, (label, v) in enumerate(items):
            yy = ax.transData.transform((0, i))[1] / fig.bbox.height
            fig.text(0.06, yy, label, fontsize=12.5, color=t.ink2, va="center")
            rounded_bar(ax, 0, v, i - 0.27, i + 0.27, t.series[0], False)
            share = "" if i == 0 else f" ({pct(v, items[0][1])} of file rows)"
            ax.annotate(f"{fmt(v)}{share}", xy=(v, i), xytext=(6, 0), textcoords="offset points",
                        va="center", ha="left", fontsize=12.5, color=t.ink,
                        annotation_clip=False)
        baseline(ax, t, horizontal=False)
        y -= row_h * len(items)
    footer(fig, t, d.pulled, [
        "Out of scope: residential operations and child-placing agencies. Bars in each group share one "
        "scale, starting at that file's row count.",
        "Map points: the state's coordinates when published, otherwise the Census Geocoder. "
        "TX-04 is a point-in-polygon test against the Census CD119 boundary.",
    ])
    save(fig, "data-funnel", t)
    write_csv("data-funnel", ["group", "stage", "count"],
              [[g, lab, v] for g, items in sections for lab, v in items])
    return dict(sections=sections, join_rate=join_rate, run_join_rate=d.join_rate)


# ---------------------------------------------------------------------------
# README
# ---------------------------------------------------------------------------


def picture(name: str, alt: str, prefix: str = "") -> str:
    return (
        "<picture>\n"
        f"  <source media=\"(prefers-color-scheme: dark)\" srcset=\"{prefix}{name}-dark.svg\">\n"
        f"  <img alt=\"{alt}\" src=\"{prefix}{name}-light.svg\" width=\"100%\">\n"
        "</picture>"
    )


def sql_block(*names: str) -> str:
    out = []
    for nm in names:
        out.append(f"`{nm}`\n\n```sql\n{globals()[nm].strip()}\n```")
    return "\n\n".join(out)


def entry(name: str, title: str, alt: str, finding: str, n: str, sqls: list[str]) -> str:
    return "\n\n".join([
        f"## {title}",
        picture(name, alt),
        f"**Finding.** {finding}",
        f"**n.** {n}",
        f"**Table view.** [`{name}.csv`]({name}.csv)",
        "**SQL** (from `scripts/figures.py`)\n\n" + sql_block(*sqls),
        "**Embed** (paths from the repo root)\n\n```html\n" + picture(name, alt, "docs/figures/")
        + "\n```",
    ])


def write_readme(d: Data, f: dict):
    m, c, fx, nap, fn = f["map"], f["months"], f["fix"], f["nap"], f["funnel"]
    risk_parts = ", ".join(f"{r} {fmt(c['by_risk'][r])} ({pct(c['by_risk'][r], c['n'])})"
                           for r in RISK_ORDER)
    cat_rows = "\n".join(
        f"| {CATEGORY_LABEL[k['category']]} | {s:.1f}% | {x:.1f}% |"
        for k, s, x in zip(f["cats"]["cats"], f["cats"]["shares_s"], f["cats"]["shares_t"])
    )
    tot = fx["total"]
    diffs = sorted(zip(f["cats"]["cats"], f["cats"]["shares_s"], f["cats"]["shares_t"]),
                   key=lambda r: -abs(r[2] - r[1]))[:2]
    gaps = "; ".join(f"{CATEGORY_LABEL[k['category']]} {x:.1f}% in TX-04 vs {s:.1f}% statewide"
                     for k, s, x in diffs)
    fix_rows = "\n".join(
        f"| {r} | {fmt(fx['by'][r]['findings'])} | {pct(fx['by'][r]['state_checked'], fx['by'][r]['findings'])} "
        f"| {pct(fx['by'][r]['fixed_during_visit'], fx['by'][r]['findings'])} "
        f"| {pct(fx['by'][r]['neither_yet'], fx['by'][r]['findings'])} |"
        for r in RISK_ORDER if r in fx["by"]
    )
    funnel_rows = "\n".join(f"| {g} | {lab} | {fmt(v)} |" for g, items in fn["sections"]
                            for lab, v in items)
    nap_tx = ", ".join(f"{q}: {x}" for q, x in nap["tx_quarters"])
    w = d.window
    lg = d.lag
    if lg["runs_with_lag"] == 0:
        lag_text = (
            f"This is not measured yet, so there is no figure and no estimate. The pipeline measures it "
            f"from findings that first appear after the backfill (`ops.sync_runs.lag_*`); across "
            f"{fmt(lg['ok_runs'])} successful runs it has had {fmt(lg['lag_sample_violations'])} such "
            f"findings, so those columns are empty (`SQL_LAG_STATUS`)."
        )
    else:
        lag_text = (
            f"{fmt(lg['runs_with_lag'])} of {fmt(lg['ok_runs'])} successful runs now record a lag in "
            f"`ops.sync_runs.lag_*` (`SQL_LAG_STATUS`); this script does not chart it yet."
        )
    text = f"""# Data figures

Every chart here is drawn by [`scripts/figures.py`](../../scripts/figures.py) from the project database, which holds the state's own files from data.texas.gov. Nothing is typed in by hand: the numbers in this page are written by the same script, from the same queries, on the same run.

```bash
uv run scripts/figures.py          # needs the local Supabase stack loaded by the pipeline
DATABASE_URL=postgresql://... uv run scripts/figures.py
```

Data pulled **{long_date(d.pulled)}** (the newest successful pipeline run in `ops.sync_runs`, Texas time; `SQL_SOURCE_RUN`). Each figure comes in a light and a dark SVG and a CSV of the plotted numbers. Re-running on the same data rewrites identical files.

**Ground rules on every figure.** A count of findings is not a verdict on a daycare; no figure names, scores, ranks, or rates a daycare. Risk level is the state's weight for the rule that was cited, not a rating of the daycare. TX-04 means the daycare's map point is inside the Census TIGERweb CD119 boundary; the state's county field is never used to claim the district. Home daycares are never drawn as points.

**Time window.** The state's visit file holds about five years. On this pull, {fmt(w['visits_first_week_inside'])} visits are dated in the week starting {long_date(w['five_years_before_pull'])} (five years before the pull) and {fmt(w['visits_last_week_before'])} in the week before it; the oldest visit is dated {long_date(w['oldest_visit'])} (`SQL_WINDOW`). Time series therefore start at the first whole month after {long_date(w['five_years_before_pull'])} and end at the last whole month before the newest finding ({long_date(w['newest_finding'])}).

**Whose findings.** {fmt(w['findings_without_operation'])} finding rows in the state's file lack a row in its operations file, and {fmt(w['operations_not_active'])} of that file's {fmt(w['operations_rows'])} rows are marked not active. So the files appear to cover daycares on the state's current list only: findings at daycares that have since closed are likely missing, and older periods may count fewer findings for that reason alone.

`SQL_SOURCE_RUN`

```sql
{SQL_SOURCE_RUN.strip()}
```

`SQL_WINDOW`

```sql
{SQL_WINDOW.strip()}
```

""" + "\n\n".join([
        entry(
            "tx04-map", "1. Active daycares inside TX-04",
            "Map of Texas congressional district 4 with one dot per active licensed child-care "
            "center, and home daycares shown only as counts per 5 km hexagon",
            f"{fmt(m['n'])} active daycares have a map point inside TX-04: {fmt(m['centers'])} "
            f"licensed centers (one dot each) and {fmt(m['homes'])} home daycares, shown only as "
            f"counts across {fmt(m['hexes'])} hexagons with 5 km sides (at most {m['max_hex']} in one "
            f"hexagon). {fmt(m['unplaced'])} more active daycares in TX-04 counties have no map "
            f"point and are not drawn. There is no street map underneath and no address anywhere "
            f"on the figure.",
            f"{fmt(m['n'])} daycares ({fmt(m['centers'])} centers, {fmt(m['homes'])} homes).",
            ["SQL_MAP_DISTRICT", "SQL_MAP_CENTERS", "SQL_MAP_HOME_HEXES", "SQL_MAP_UNPLACED"],
        ),
        entry(
            "findings-by-month", "2. Findings per month, statewide, by risk level",
            "Stacked monthly columns of state findings at Texas daycares, split by the state's "
            "risk level for the rule",
            f"From {month_label(c['first'])} to {month_label(c['last'])}, findings dated in one month "
            f"ranged from {fmt(c['min_month'])} to {fmt(c['max_month'])} at in-scope daycares "
            f"(median {fmt(c['median_month'])}). By the state's risk level for the rule: {risk_parts}. "
            f"Left out: {fmt(c['outside']['before_first'])} findings dated before "
            f"{month_label(c['first'])} and {fmt(c['outside']['after_last'])} in the month in progress.",
            f"{fmt(c['n'])} of {fmt(c['outside']['all_findings'])} loaded findings.",
            ["SQL_FINDINGS_BY_MONTH", "SQL_FINDINGS_OUTSIDE"],
        ),
        entry(
            "categories", "3. Rule categories, statewide vs TX-04",
            "Dot plot of the share of findings in each rule category, statewide and in TX-04",
            f"{f['cats']['top']} is the largest category both statewide and in TX-04. The two widest "
            f"gaps: {gaps}. Shares by category:\n\n| Category | Statewide | TX-04 |\n|---|---:|---:|\n{cat_rows}",
            f"{fmt(f['cats']['n_state'])} findings statewide; {fmt(f['cats']['n_tx'])} at daycares "
            f"inside TX-04 by map point.",
            ["SQL_CATEGORY_SHARES"],
        ),
        entry(
            "fix-follow-through", "4. Fix follow-through, last 24 months",
            "Horizontal 100% bars: share of findings where the state recorded checking the fix, "
            "where it was fixed during the visit, or neither yet, overall and by risk level",
            f"Of {fmt(tot['findings'])} findings dated {long_date(fx['first'])} to "
            f"{long_date(fx['last'])}, the state recorded checking the fix on "
            f"{fmt(tot['state_checked'])} ({pct(tot['state_checked'], tot['findings'])}), "
            f"{fmt(tot['fixed_during_visit'])} ({pct(tot['fixed_during_visit'], tot['findings'])}) "
            f"were fixed during the visit, and {fmt(tot['neither_yet'])} "
            f"({pct(tot['neither_yet'], tot['findings'])}) have neither on record yet. Newer findings "
            f"have had less time for a state check. Counted as the file states: "
            f"{fmt(tot['checked_after_pull'])} findings carry a check date after the pull date and "
            f"{fmt(tot['checked_before_visit'])} a check date before the visit date.\n\n"
            f"| Risk level | Findings | State checked | Fixed during visit | Neither yet |\n"
            f"|---|---:|---:|---:|---:|\n{fix_rows}",
            f"{fmt(tot['findings'])} findings statewide.",
            ["SQL_FIX_FOLLOW_THROUGH"],
        ),
        entry(
            "nap-rule", "5. Nap rule 746.2905(1) citations per quarter",
            "Quarterly columns of citations of Texas rule 746.2905(1), statewide, with the TX-04 "
            "part marked",
            f"The state cited rule 746.2905(1) {fmt(nap['n_state'])} times from "
            f"{quarter_label(nap['first'])} to {quarter_label(nap['last'])} (at most {nap['peak']} in "
            f"a quarter); {fmt(nap['n_tx'])} of those were at daycares inside TX-04 ({nap_tx}). "
            f"The whole file holds {fmt(nap['all_state'])} citations, {fmt(nap['all_tx'])} in TX-04.",
            f"{fmt(nap['n_state'])} citations in whole quarters ({fmt(nap['all_state'])} in the file).",
            ["SQL_NAP_RULE_BY_QUARTER", "SQL_NAP_RULE_TITLES"],
        ),
        entry(
            "data-funnel", "6. From the state's files to the app",
            "Horizontal bars from the state's raw row counts to in-scope daycares, visits and "
            "findings, findings joined to their visit, and daycares inside TX-04",
            f"Of {fmt(fn['sections'][0][1][0][1])} rows in the state's operations file, "
            f"{fmt(fn['sections'][0][1][1][1])} are daycares in scope and "
            f"{fmt(fn['sections'][0][1][3][1])} are active inside TX-04 by map point; of "
            f"{fmt(fn['sections'][2][1][0][1])} finding rows, {fmt(fn['sections'][2][1][1][1])} are "
            f"at in-scope daycares and {fmt(fn['sections'][2][1][2][1])} join to their state visit "
            f"(join rate {fn['join_rate']:.3f}; the run recorded {fn['run_join_rate']:g}).\n\n"
            f"| Group | Stage | Count |\n|---|---|---:|\n{funnel_rows}",
            "Every row of the three state files in the newest run.",
            ["SQL_SOURCE_RUN", "SQL_FUNNEL_CORE"],
        ),
    ]) + f"""

## Not charted: days from inspection to posting

{lag_text} The state's own row timestamps cannot stand in for it: on Oct 25 2026, every one of the 133,739 rows in the findings dataset `tqgd-mf4x` carried the same Socrata `:created_at` (`2026-10-24T09:06:16.759Z`, the time of the nightly full reload), so they date the reload, not the posting. Checked with

```bash
curl -s "https://data.texas.gov/resource/tqgd-mf4x.json?\\$select=:created_at,count(*)&\\$group=:created_at&\\$limit=5"
```

`SQL_LAG_STATUS`

```sql
{SQL_LAG_STATUS.strip()}
```

## Colors

The app's own palette: ink for the mark that matters (TX-04, licensed centers, a state check on record) and warm grays for context, with light and dark steps chosen for each surface (`#ffffff`, `#0d1117`). Risk level is ordinal, so it is one ramp from ink (High) to light gray (Low), in the state's order, never a set of hues. The map's hexagons use a gray ramp for counts. The app's yellow is left out, because in the app it means only watching and alerts. Labels on a filled bar are black or white, whichever reads on that fill; every chart has a CSV table view.
"""
    (OUT / "README.md").write_text(text)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    d = load()
    facts = {}
    for t in (LIGHT, DARK):
        facts["map"] = fig_map(d, t)
        facts["months"] = fig_findings_by_month(d, t)
        facts["cats"] = fig_categories(d, t)
        facts["fix"] = fig_fix(d, t)
        facts["nap"] = fig_nap(d, t)
        facts["funnel"] = fig_funnel(d, t)
    write_readme(d, facts)
    for p in sorted(OUT.iterdir()):
        print(p.relative_to(ROOT))


if __name__ == "__main__":
    main()
