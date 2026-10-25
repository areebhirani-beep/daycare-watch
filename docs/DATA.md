# Data dictionary

Every fact in the app comes from one of three public sources. This page maps each field a parent sees to the exact column it comes from, and lists every value we derive ourselves and how.

| Source | Dataset | Publisher |
|---|---|---|
| Daycares | [`bc5r-88dy`](https://data.texas.gov/d/bc5r-88dy) Child Care Regulation operations | Texas HHSC on data.texas.gov |
| Visits | [`m5q4-3y3d`](https://data.texas.gov/d/m5q4-3y3d) Child Care Regulation activities | Texas HHSC on data.texas.gov |
| Findings | [`tqgd-mf4x`](https://data.texas.gov/d/tqgd-mf4x) Child Care Regulation non-compliance | Texas HHSC on data.texas.gov |
| Map points | Census Geocoder batch API (`Public_AR_Current`) | U.S. Census Bureau |
| District boundary | TIGER/Line CD119, Texas district 4 | U.S. Census Bureau |
| Street photos (collected, not shown) | Mapillary Graph API `images` | Mapillary (open street-level imagery) |

Every row passes a pydantic data contract before it is loaded ([`models.py`](../services/pipeline/src/pipeline/models.py)). An unknown risk level, a missing required field, or a bad date fails the whole run rather than loading a guess.

## A daycare (`core.daycares`)

| Shown in the app | State column (`bc5r-88dy`) | Our column | Notes |
|---|---|---|---|
| Name | `operation_name` | `name` | Verbatim; runs of spaces collapsed only for display |
| Type ("Licensed child care center", "Licensed child-care home", ...) | `operation_type` | `operation_type` | Four types are in scope: Licensed Center, Licensed Child-Care Home, Registered Child-Care Home, Listed Family Home |
| Street address (centers only) | `address_line`, `city`, `zipcode` | `address_line`, `city`, `zip` | Home daycares show city and ZIP only |
| Ages | `licensed_to_serve_ages` | `ages` | Comma list split into chips |
| Hours and days | `hours_of_operation`, `days_of_operation` | `hours`, `days` | |
| Capacity | `total_capacity` | `capacity` | |
| Accepts subsidies | `accepts_child_care_subsidies` | `accepts_subsidies` | `Y` / `N` |
| Permit | `type_of_issuance`, `issuance_date` | `issuance_type`, `issuance_date` | |
| Permit status (active or inactive) | `operation_status` | `operation_status` | A change sends an alert |
| Corrective action · adverse action · temporarily closed · conditions on permit | `corrective_action`, `adverse_action`, `temporarily_closed`, `conditions_on_permit` | same names | `YES` / `NO`; a change sends an alert. Plain-English meanings are quoted in [`OFFICIAL_SOURCES.md`](OFFICIAL_SOURCES.md) §6 |
| "State record" link | `operation_id` | `operation_id` | `https://childcare.hhs.texas.gov/Public/OperationDetails?operationId=<id>` |

## A visit (`core.inspections`)

| Shown in the app | State column (`m5q4-3y3d`) | Our column | Notes |
|---|---|---|---|
| Visit date | `activity_date` | `activity_date` | Texas local time, stored as America/Chicago |
| Kind of visit | `activity_type` | `activity_type` | `INSPECTION`, `REPORT` (an investigation of a report), or `ASSESSMENT` |
| Whether the state found violations | `violation_found` | `violation_found` | `Yes`, `No`, or `Pending` (findings not posted yet) |

## A finding (`core.violations`)

| Shown in the app | State column (`tqgd-mf4x`) | Our column | Notes |
|---|---|---|---|
| Date | via `activity_id` → visit date | `activity_date` | Joined to the visit; the run fails if fewer than 95% join (measured: 100%) |
| Risk level of the rule | `standard_risk_level` | `risk_level` | The state's own weight for the rule: High, Medium High, Medium, Medium Low, Low. It rates the rule, not the daycare |
| Rule | `standard_number_description` | `standard_code`, `standard_title` | Split at the first " - " |
| The inspector's words | `narrative` | `narrative` | Verbatim |
| Fixed during the visit | `corrected_at_inspection` | `corrected_at_inspection` | Shown as "Fixed during the visit" |
| Fix due date | `corrected_date` | `corrected_date` | 124 fall in the future, so it is a due date, never proof of a fix: "Fix due <date>" or "Fix date was <date>", each with "no state check on record yet" on the finding |
| State checked the fix | `date_correction_verified` | `verified_date` | "Fixed · the state checked <date>" (list rows: "Fixed · state checked"). Only this, or a fix during the visit, earns the word "Fixed", and never on its own |
| Help given by the inspector | `technical_assistance_given` | `technical_assistance` | |
| Came from an investigation | `activity_type = REPORT` on the joined visit | `via_investigation` | |

## Values we derive

| Value | How | Code |
|---|---|---|
| Category (Supervision, Safety hazards, Paperwork, ...) | Fixed rules on the rule number and title. No model, no guessing; every rule is tested | [`classify.py`](../services/pipeline/src/pipeline/classify.py) |
| Plain summary | The inspector's first sentence that states a problem, shortened and de-jargoned. It only removes words: a property test proves it adds no numbers, and a test over every finding in the state file proves it adds no words | same |
| Map point | The state's coordinates when published (577 daycares); otherwise a Census Geocoder match on the address | [`geocode.py`](../services/pipeline/src/pipeline/geocode.py) |
| Map point quality | `state`, `exact`, or `non_exact` (address matched with corrections) | same |
| In TX-04 | The map point inside the CD119 polygon (PostGIS `ST_Covers`). The state's county field is never used to claim the district | [`load.py`](../services/pipeline/src/pipeline/load.py) |
| Area comparison | Median findings in 24 months for the same daycare type in the same county | `core.area_medians` (materialized view) |
| Alerts | A new finding, a permit status change, a capacity change, or a change in any enforcement flag, found by diffing each night's state files | `core.change_events`; [`load.py`](../services/pipeline/src/pipeline/load.py), [`notify.py`](../services/pipeline/src/pipeline/notify.py) |
| Street photos (collected and measured, **not shown in the app**: a hand check found 2 of 5 showed the right building, because a Census address point sits on the street, not the building; 14 of 209 TX-04 centers pass every rule) | Up to 3 Mapillary images within 50 m of an exactly matched Licensed Center whose camera faces the building and looks sideways from its direction of travel, so dashcam frames looking down the road are dropped. Frames from the same moment and angle count once. A photo is kept only if it was taken on or after the daycare's permit `issuance_date` and within the last 6 years, so it shows this daycare and today's street. No panoramas | [`photos.py`](../services/pipeline/src/pipeline/photos.py) |

## Freshness

The state reloads visits and findings in full each night and updates daycares row by row. The pipeline runs daily at 10:15 UTC ([`daily-sync.yml`](../.github/workflows/daily-sync.yml)) and writes one row per run to `ops.sync_runs`; the app's "Last checked with the state" line reads it through `last_sync()`. Findings appear only after the daycare has had due process, so they can post days to weeks after a visit.
