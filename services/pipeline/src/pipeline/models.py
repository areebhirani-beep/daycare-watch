"""Stage 2, validate: the data contract (docs/DATA.md) as pydantic models.

Every source row passes through one of these models. An unknown risk level, a missing
required field, or an unparseable date raises, and the run fails rather than loading a guess.
Source timestamps are floating Texas local times; they are pinned to America/Chicago.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Any, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, ValidationError, field_validator

TEXAS = ZoneInfo("America/Chicago")

RISK_LEVELS: dict[str, str] = {
    "High": "high",
    "Medium High": "medium_high",
    "Medium": "medium",
    "Medium Low": "medium_low",
    "Low": "low",
}


def _blank_to_none(v: Any) -> Any:
    if isinstance(v, str) and not v.strip():
        return None
    return v


def _flag(true: str, false: str) -> BeforeValidator:
    def parse(v: Any) -> Any:
        if isinstance(v, bool) or v is None:
            return v
        s = str(v).strip().upper()
        if s == true:
            return True
        if s == false:
            return False
        if s == "":
            return None
        raise ValueError(f"expected {true!r} or {false!r}, got {v!r}")

    return BeforeValidator(parse)


def _source_date(v: Any) -> Any:
    v = _blank_to_none(v)
    if isinstance(v, str):
        return datetime.fromisoformat(v.strip()[:19]).date()
    return v


def _source_timestamp(v: Any) -> Any:
    v = _blank_to_none(v)
    if isinstance(v, str):
        return datetime.fromisoformat(v.strip()[:19]).replace(tzinfo=TEXAS)
    return v


def _int_or_none(v: Any) -> Any:
    v = _blank_to_none(v)
    if isinstance(v, str):
        return int(v.strip())
    return v


YN = Annotated[bool, _flag("Y", "N")]
YN_OPT = Annotated[bool | None, _flag("Y", "N")]
YESNO = Annotated[bool, _flag("YES", "NO")]
SourceDate = Annotated[date, BeforeValidator(_source_date)]
SourceDateOpt = Annotated[date | None, BeforeValidator(_source_date)]
SourceTs = Annotated[datetime, BeforeValidator(_source_timestamp)]
IntOpt = Annotated[int | None, BeforeValidator(_int_or_none)]
StrOpt = Annotated[str | None, BeforeValidator(_blank_to_none)]
ReqStr = Annotated[str, Field(min_length=1)]


class _Row(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True, str_strip_whitespace=True)


class Activity(_Row):
    operation_id: int
    activity_id: int
    activity_date: SourceTs
    activity_type: Literal["INSPECTION", "REPORT", "ASSESSMENT"]
    self_report: YN_OPT = None
    violation_found: Literal["Yes", "No", "Pending"]


class Violation(_Row):
    operation_id: int
    activity_id: int
    section_id: int
    non_compliance_id: int
    standard_number_description: ReqStr
    standard_risk_level: str
    corrected_at_inspection: YN
    corrected_date: SourceDate
    date_correction_verified: SourceDateOpt = None
    narrative: StrOpt = None
    technical_assistance_given: YESNO

    @field_validator("standard_risk_level")
    @classmethod
    def _known_risk(cls, v: str) -> str:
        if v not in RISK_LEVELS:
            raise ValueError(f"unknown standard_risk_level {v!r}")
        return v

    @property
    def risk_level(self) -> str:
        return RISK_LEVELS[self.standard_risk_level]


class Operation(_Row):
    operation_id: int
    operation_number: StrOpt = None
    operation_name: ReqStr
    operation_type: ReqStr
    location_address: StrOpt = None
    address_line: StrOpt = None
    city: StrOpt = None
    county: StrOpt = None
    state: StrOpt = None
    zipcode: StrOpt = None
    phone_number: StrOpt = None
    type_of_issuance: StrOpt = None
    issuance_date: SourceDateOpt = None
    total_capacity: IntOpt = None
    licensed_to_serve_ages: StrOpt = None
    hours_of_operation: StrOpt = None
    days_of_operation: StrOpt = None
    accepts_child_care_subsidies: YN_OPT = None
    operation_status: YN
    conditions_on_permit: YESNO
    corrective_action: YESNO
    adverse_action: YESNO
    temporarily_closed: YESNO
    deficiency_high: IntOpt = None
    deficiency_medium_high: IntOpt = None
    deficiency_medium: IntOpt = None
    deficiency_medium_low: IntOpt = None
    deficiency_low: IntOpt = None
    total_inspections: IntOpt = None
    total_reports: IntOpt = None
    total_assessments: IntOpt = None
    total_self_reports: IntOpt = None
    programs_provided: StrOpt = None
    latitude: float | None = None
    longitude: float | None = None
    updated_at: datetime | None = Field(default=None, alias=":updated_at")

    @classmethod
    def from_source(cls, raw: dict[str, Any]) -> Operation:
        """Lift lat/lng out of the nested location_address_geo object before validating."""
        geo = raw.get("location_address_geo")
        flat = dict(raw)
        if isinstance(geo, dict):
            flat["latitude"] = geo.get("latitude")
            flat["longitude"] = geo.get("longitude")
        return cls.model_validate(flat)

    @property
    def ages(self) -> list[str]:
        return split_list(self.licensed_to_serve_ages)

    @property
    def days(self) -> list[str]:
        return split_list(self.days_of_operation)

    @property
    def programs(self) -> list[str]:
        return split_list(self.programs_provided)


def split_list(value: str | None) -> list[str]:
    """The state publishes multi-valued fields as comma-joined strings."""
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


class ContractError(ValueError):
    """Raised when source rows break the data contract. Carries the first few failures."""

    def __init__(self, dataset: str, failures: list[str], total: int) -> None:
        self.dataset = dataset
        self.failures = failures
        self.total = total
        super().__init__(f"{dataset}: {total} rows broke the data contract, e.g. {failures[:3]}")


def validate_rows[M: BaseModel](
    dataset: str, rows: list[dict[str, Any]] | list[dict[str, str]], parse: Any
) -> list[M]:
    """Validate every row with `parse` (a model's model_validate or from_source). All or nothing."""
    out: list[M] = []
    failures: list[str] = []
    bad = 0
    for i, raw in enumerate(rows):
        try:
            out.append(parse(raw))
        except ValidationError as exc:
            bad += 1
            if len(failures) < 20:
                err = exc.errors()[0]
                failures.append(f"row {i}: {'.'.join(map(str, err['loc']))}: {err['msg']}")
    if bad:
        raise ContractError(dataset, failures, bad)
    return out
