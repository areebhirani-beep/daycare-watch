"""Contract tests: every real captured record validates, and contract breaks fail loudly."""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from hypothesis import given
from hypothesis import strategies as st

from pipeline.models import (
    TEXAS,
    Activity,
    ContractError,
    Operation,
    Violation,
    restore_lost_chars,
    validate_rows,
)


def test_real_activities_validate(acts_raw: list[dict[str, str]]) -> None:
    rows: list[Activity] = validate_rows("activities", acts_raw, Activity.model_validate)
    assert len(rows) == len(acts_raw) > 100
    assert all(r.activity_date.tzinfo is TEXAS for r in rows)
    assert {r.violation_found for r in rows} <= {"Yes", "No", "Pending"}


def test_real_violations_validate(viols_raw: list[dict[str, str]]) -> None:
    rows: list[Violation] = validate_rows("violations", viols_raw, Violation.model_validate)
    assert len(rows) == len(viols_raw) > 100
    assert {r.risk_level for r in rows} <= {"high", "medium_high", "medium", "medium_low", "low"}
    assert all(isinstance(r.corrected_date, date) for r in rows)


def test_real_operations_validate(ops_raw: list[dict[str, Any]]) -> None:
    rows: list[Operation] = validate_rows("operations", ops_raw, Operation.from_source)
    assert len(rows) == len(ops_raw)
    assert all(r.updated_at is not None for r in rows)
    assert all(r.ages for r in rows)


def test_operation_lifts_coordinates() -> None:
    op = Operation.from_source(
        {
            "operation_id": "1",
            "operation_name": "x",
            "operation_type": "Licensed Center",
            "operation_status": "Y",
            "conditions_on_permit": "NO",
            "corrective_action": "NO",
            "adverse_action": "YES",
            "temporarily_closed": "NO",
            "location_address_geo": {"latitude": "33.1", "longitude": "-96.8", "human_address": "{}"},
            "licensed_to_serve_ages": "Infant, Toddler,",
        }
    )
    assert (op.latitude, op.longitude) == (33.1, -96.8)
    assert op.adverse_action is True
    assert op.ages == ["Infant", "Toddler"]


def _one(viols_raw: list[dict[str, str]], **change: str) -> list[dict[str, str]]:
    return [{**viols_raw[0], **change}]


@pytest.mark.parametrize(
    "change",
    [
        {"standard_risk_level": "Severe"},
        {"standard_risk_level": "high"},
        {"corrected_date": "not a date"},
        {"corrected_date": ""},
        {"non_compliance_id": ""},
        {"standard_number_description": ""},
        {"corrected_at_inspection": "maybe"},
        {"technical_assistance_given": "Y"},
    ],
)
def test_contract_breaks_fail(viols_raw: list[dict[str, str]], change: dict[str, str]) -> None:
    with pytest.raises(ContractError) as err:
        validate_rows("violations", _one(viols_raw, **change), Violation.model_validate)
    assert err.value.total == 1


def test_unknown_activity_type_fails(acts_raw: list[dict[str, str]]) -> None:
    with pytest.raises(ContractError):
        validate_rows("activities", [{**acts_raw[0], "activity_type": "PHONE CALL"}], Activity.model_validate)


def test_missing_field_fails(acts_raw: list[dict[str, str]]) -> None:
    row = dict(acts_raw[0])
    del row["violation_found"]
    with pytest.raises(ContractError):
        validate_rows("activities", [row], Activity.model_validate)


def test_optional_blanks_are_none(viols_raw: list[dict[str, str]]) -> None:
    v: Violation
    (v,) = validate_rows(
        "violations", _one(viols_raw, narrative=" ", date_correction_verified=""), Violation.model_validate
    )
    assert v.narrative is None
    assert v.date_correction_verified is None


def test_error_carries_examples(viols_raw: list[dict[str, str]]) -> None:
    bad = [{**r, "standard_risk_level": "??"} for r in viols_raw[:30]]
    with pytest.raises(ContractError) as err:
        validate_rows("violations", bad, Violation.model_validate)
    assert err.value.total == 30
    assert len(err.value.failures) == 20
    assert "standard_risk_level" in str(err.value)


@pytest.mark.parametrize(("state_name", "shown"), [
    # Real names from the state's file, where a non-ASCII character arrives as "?"
    ("AlphaBEST @ Allen ? Frisco", "AlphaBEST @ Allen - Frisco"),
    ("Montessori Children?s House & School", "Montessori Children's House & School"),
    ("HONESTY KID?S ACADEMY", "HONESTY KID'S ACADEMY"),
    ("AlphaBEST @ O?Dell - Celina", "AlphaBEST @ O'Dell - Celina"),
    ("Los Peque?os Exploradores", "Los Pequeños Exploradores"),
    ("Peque?as Estrellas Spanish Immersion Home Daycare", "Pequeñas Estrellas Spanish Immersion Home Daycare"),
    ("Claudia Iveth Trevi?o Sanchez", "Claudia Iveth Treviño Sanchez"),
    # The lost character is not certain here, so the state's spelling stays
    ("T?aikabede Jose Sierra Sr Youth Learning Center", "T?aikabede Jose Sierra Sr Youth Learning Center"),
])
def test_names_restore_only_certain_lost_characters(state_name: str, shown: str) -> None:
    assert restore_lost_chars(state_name) == shown


@given(st.text().filter(lambda t: "?" not in t))
def test_a_name_without_a_question_mark_is_never_changed(name: str) -> None:
    assert restore_lost_chars(name) == name
