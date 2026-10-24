"""Tests for pipeline.classify. Standard strings below are copied verbatim from data.texas.gov tqgd-mf4x."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from pipeline.classify import (
    MAX_SUMMARY,
    REPLACEMENT_WORDS,
    REPLACEMENTS,
    RULES,
    categorize,
    match_rule,
    parse_standard,
    plain_summary,
)

GOLDEN: list[dict[str, Any]] = json.loads(
    (Path(__file__).parent.parent / "fixtures" / "golden_narratives.json").read_text(encoding="utf-8")
)
NUMBER = re.compile(r"\d+(?:[.:]\d+)*")


def words(text: str) -> set[str]:
    return set(re.findall(r"[^\W\d_]+|\d+", text.lower()))


def assert_faithful(source: str, summary: str | None) -> None:
    if summary is None:
        return
    assert len(summary) <= MAX_SUMMARY
    assert set(NUMBER.findall(summary)) <= set(NUMBER.findall(source))
    assert words(summary) - REPLACEMENT_WORDS <= words(source)


# --- parse_standard -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("desc", "code", "title"),
    [
        (
            "746.1601 - Child/ Caregiver Ratio - 13 or More Children",
            "746.1601",
            "Child/ Caregiver Ratio - 13 or More Children",
        ),
        (
            "746.1201(1) - Responsibilities of Employees and Caregivers -Demonstrate Competency, Good Judgment, "
            "Self-control",
            "746.1201(1)",
            "Responsibilities of Employees and Caregivers -Demonstrate Competency, Good Judgment, Self-control",
        ),
        ("HRC42.052(c) - AP Illegal Operation - Not Listed", "HRC42.052(c)", "AP Illegal Operation - Not Listed"),
        ("HRC 42.04271 - Parent's Rights", "HRC42.04271", "Parent's Rights"),
        (
            'HRC Sec. 42.068 - Required Postings-Residential Treatment Center\'s must have "No Trespassing Signs" '
            "posted.",
            "HRC42.068",
            'Required Postings-Residential Treatment Center\'s must have "No Trespassing Signs" posted.',
        ),
        (
            "74 7.1327(c)(1)(A) - Documentation of Pediatric First-Aid and Pediatric CPR Includes Trainer information",
            "747.1327(c)(1)(A)",
            "Documentation of Pediatric First-Aid and Pediatric CPR Includes Trainer information",
        ),
        (
            "749.2447(7)(B)(i)  - Foster Home Screening- Obtain service call information from law enforcement for "
            "past two years",
            "749.2447(7)(B)(i)",
            "Foster Home Screening- Obtain service call information from law enforcement for past two years",
        ),
        ("746.1601", "746.1601", ""),
        ("746.1601(a)Child/Caregiver Ratio", "746.1601(a)", "Child/Caregiver Ratio"),
        ("746.2805-Prohibited Punishments", "746.2805", "Prohibited Punishments"),
        ("Prohibited Punishments - Corporal Punishment", "", "Prohibited Punishments - Corporal Punishment"),
        ("", "", ""),
    ],
)
def test_parse_standard(desc: str, code: str, title: str) -> None:
    assert parse_standard(desc) == (code, title)


# --- categorize: one real standard per rule, in rule order ----------------------------------------

RULE_CASES: list[tuple[int, str, str]] = [
    (
        0,
        "745.641 - AP Background check results - Must receive notification prior to allowing subject to be "
        "present at your operation",
        "background_checks",
    ),
    (
        1,
        "745.4151(c)(4)(A) - Mandatory drug testing-all applicants intended to be hired are subject to "
        "pre-employment testing, must have results prior to child access",
        "background_checks",
    ),
    (2, "HRC42.056 - Background Checks", "background_checks"),
    (3, "746.307(b)(4) - Parental Communication - Situation that Placed a Child at Risk", "parent_communication"),
    (3, "HRC 42.04271 - Parent's Rights", "parent_communication"),
    (4, "746.305(a)(6) - Report Situation Placing Children at Risk", "paperwork_admin"),
    (4, "HRC42.052(c) - AP Illegal Operation - Not Listed", "paperwork_admin"),
    (5, "746.1601 - Child/ Caregiver Ratio - 13 or More Children", "staff_ratio"),
    (6, "746.2805(3) - Prohibited Punishments - Grabbing and Pulling", "discipline"),
    (
        7,
        "746.1205(a)(4) - Supervision ensures each child?s safety, well-being, including physical proximity and "
        "auditory or visual awareness of each child?s on going activity",
        "supervision",
    ),
    (
        8,
        "748.753(a)(2) - Pre-Employment Screening-You must contact each of the two references to verify that the "
        "applicant is suitable to work with or around children.",
        "background_checks",
    ),
    (9, "747.207(10) - AP Never exceed capacity of the home", "staff_ratio"),
    (
        10,
        "749.1953(a) - Corporal Punishment-May not use/threaten corporal punishment, such as hitting/spanking, "
        "forced exercise, holding physical position, unproductive work.",
        "discipline",
    ),
    (
        11,
        "748.685(a)(4) - Caregiver responsibility - providing the level of supervision necessary to ensure each "
        "child's safety and well-being",
        "supervision",
    ),
    (12, "746.501(a)(20) - Written Operational Policies - Parent Rights", "parent_communication"),
    (13, "746.1309(e) - Documented Annual Training- Required Content", "paperwork_admin"),
    (14, "746.501(a)(18) - Written Operational Policies - Promotion of Physical Activity", "paperwork_admin"),
    (15, "746.5101(a) - Annual Fire Inspection - Before Initial Permit Issued and Every 12 Months", "safety_hazards"),
    (16, "746.603(a)(4) - Children's Records - Immunizations", "health_medication"),
    (17, "746.605(6) - Required Admission Information - Emergency Contact", "paperwork_admin"),
    (18, "746.3701 - Safety - Areas Free From Hazards", "safety_hazards"),
    (19, "746.631(a) - Sign-in and Sign-out Tracking System", "paperwork_admin"),
    (20, "746.4505 - Storage for Individual Belongings", "safety_hazards"),
]


@pytest.mark.parametrize(("rule_index", "desc", "category"), RULE_CASES)
def test_categorize_rule(rule_index: int, desc: str, category: str) -> None:
    assert match_rule(desc) is RULES[rule_index]
    assert categorize(desc) == category


def test_every_rule_has_a_case() -> None:
    assert {i for i, _, _ in RULE_CASES} == set(range(len(RULES)))


@pytest.mark.parametrize(
    ("desc", "category"),
    [
        # Ordering traps: a later keyword must not steal these.
        (
            "746.1316(a) - Transportation Safety Training -Director and Employee Complete 2 Hours Annually",
            "paperwork_admin",
        ),
        (
            "746.3407(12) - Mark Cleaning Supplies, Toxic Materials; Keep Separate from Food and Inaccessible to "
            "Children",
            "safety_hazards",
        ),
        ("746.4135(b) - Children's Products- Annual Certification", "safety_hazards"),
        ("746.3805(b)(3) - Administering Medication - Not After Expiration date", "health_medication"),
        (
            "748.2003(b)(3) - AP Administration of prescription medication-Administer medications according to "
            "instructions or a prescribing health-care professional's orders",
            "health_medication",
        ),
        ("746.603(a)(6) - Children's Records - Vision and Hearing Screening", "health_medication"),
        ("746.2431 - Infant Daily Report - Share with Parent", "parent_communication"),
        (
            "744.1205(a)(4) - Supervision ensures each child?s safety, well-being, including physical proximity and "
            "auditory or visual awareness of each child?s on going activity",
            "supervision",
        ),
        ("746.2207(a) - Screen Time Activities - Not Used for Under Two", "other"),
        ("", "other"),
    ],
)
def test_categorize_edge_cases(desc: str, category: str) -> None:
    assert categorize(desc) == category


# --- plain_summary ------------------------------------------------------------------------------


@pytest.mark.parametrize("narrative", [None, "", "   ", "\n\t "])
def test_plain_summary_empty(narrative: str | None) -> None:
    assert plain_summary(narrative) is None


@pytest.mark.parametrize(
    ("narrative", "expected"),
    [
        ("The annual fire inspection has not been conducted.", "The annual fire inspection has not been conducted."),
        ("The  operation   did not\nhave a plan.", "The daycare did not have a plan."),
        (
            "The infant bottles in the infant room was not labeled.    Note:  Corrected at inspection.",
            "The infant bottles in the infant room was not labeled.",
        ),
        (
            "During the inspection a food allergy plan had not been signed by a parent.",
            "A food allergy plan had not been signed by a parent.",
        ),
        (
            "It was found that site director changes were not notified to CCR.     Note: Site director was designated "
            "in December.",
            "Site director changes were not notified to CCR.",
        ),
        (
            "Based on information obtained during a DFPS investigation, a caregiver did not use good judgment.",
            "A caregiver did not use good judgment.",
        ),
        (
            "During a review of the records, it was observed that a child was missing a form.",
            "During a review of the records, it was observed that a child was missing a form.",
        ),
        (
            "This standard was evaluated in regard to an investigation. A minimum standard violation was found. "
            "In the summer of 2021, the operation did not report an injury.",
            "In the summer of 2021, the daycare did not report an injury.",
        ),
        (
            "At 2:15 p.m. Child A was found alone in the hallway. Staff were notified.",
            "At 2:15 p.m. Child A was found alone in the hallway.",
        ),
        (
            "1. The caregiver left w/o telling anyone. 2. The gate was open.",
            "1. The caregiver left without telling anyone.",
        ),
        (
            "A 3yo child & a 4 y/o child were in a 2yr old room w/ approx. 9 kids for 2 hrs.",
            "A 3-year-old child and a 4-year-old child were in a 2 year old room with approximately 9 kids "
            "for 2 hours.",
        ),
        ("The operation?s staff didn?t check.", "The daycare's staff didn't check."),
        (
            "THE OPERATION DID NOT HAVE A FIRE DRILL AND I SAW IT.",
            "The daycare did not have a fire drill and I saw it.",
        ),
        ("caregivers were on phones.", "Caregivers were on phones."),
        (
            "Upon reviewing children's files, one child was missing a health statement.",
            "Upon reviewing children's files, one child was missing a health statement.",
        ),
    ],
)
def test_plain_summary_cases(narrative: str, expected: str) -> None:
    assert plain_summary(narrative) == expected
    assert_faithful(narrative, expected)


def test_plain_summary_long_sentence_cut_at_word_boundary() -> None:
    narrative = (
        "The inspector observed one teacher that had left 2 toddlers and 2 infants on highchairs from 3:05 PM to "
        "4:23 PM until the owner stepped in to remove the children out of the highchairs to participate in other "
        "activities."
    )
    out = plain_summary(narrative)
    assert out is not None and out.endswith("…") and len(out) <= MAX_SUMMARY
    assert "3:05 PM to 4:23 PM" in out
    assert out[:-1] in narrative  # a pure prefix of the source
    assert_faithful(narrative, out)


def test_plain_summary_prefers_late_clause_break() -> None:
    narrative = ("x" * 50 + " ") * 2 + "abcdefghijklmnopqrstuvwxyz, then more words that run well past the limit here."
    out = plain_summary(narrative)
    assert out is not None and out.endswith("abcdefghijklmnopqrstuvwxyz…")


def test_plain_summary_giant_token_never_splits_a_number() -> None:
    assert plain_summary("x" * 130 + ",123456789012345") == "X" + "x" * 129 + "…"
    assert plain_summary("9" * 200) is None


def test_replacement_table_adds_no_digits() -> None:
    for pattern, replacement in REPLACEMENTS:
        assert not re.search(r"\d", replacement.replace(r"\1", "")), pattern.pattern  # \1 re-uses source text
    assert not any(ch.isdigit() for w in REPLACEMENT_WORDS for ch in w)


# --- golden fixture -----------------------------------------------------------------------------


def test_golden_fixture_shape() -> None:
    assert len(GOLDEN) == 50
    assert len({g["non_compliance_id"] for g in GOLDEN}) == 50


@pytest.mark.parametrize("row", GOLDEN, ids=[g["non_compliance_id"] for g in GOLDEN])
def test_golden(row: dict[str, Any]) -> None:
    assert categorize(row["standard_number_description"]) == row["expected_category"]
    assert plain_summary(row["narrative"]) == row["expected_plain"]
    if row["narrative"] is not None:
        assert_faithful(row["narrative"], row["expected_plain"])


SNAPSHOT = Path(__file__).parent.parent / ".cache" / "tqgd-mf4x.csv"


@pytest.mark.skipif(not SNAPSHOT.exists(), reason="local data.texas.gov snapshot not downloaded")
def test_full_snapshot_is_faithful() -> None:
    with SNAPSHOT.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            assert_faithful(row["narrative"], plain_summary(row["narrative"] or None))


# --- properties ---------------------------------------------------------------------------------

_TOKENS = st.one_of(
    st.from_regex(r"\d{1,2}:\d{2} ?(?:[ap]\.m\.|AM|PM)", fullmatch=True),
    st.from_regex(r"\d{1,2}/\d{1,2}/\d{2,4}", fullmatch=True),
    st.from_regex(r"\d+(?:\.\d+)?(?:yo|yrs|yr| y/o)?", fullmatch=True),
    st.sampled_from(
        [
            "The",
            "operation",
            "the operation",
            "operation's",
            "w/",
            "w/o",
            "&",
            "approx.",
            "caregiver",
            "child?s",
            "It was found that",
            "During the inspection,",
            "Based on information obtained,",
            "p.m.",
            "Mr.",
            "No.",
            ".",
            ",",
            ";",
            ":",
            "A",
            "i",
            "infant",
            "ratio",
            "\n",
            "  ",
        ]
    ),
    st.text(min_size=1, max_size=12),
)
narratives = st.lists(_TOKENS, min_size=1, max_size=60).map(" ".join)


@settings(max_examples=400, deadline=None)
@given(narratives)
def test_property_structured_text_is_faithful(narrative: str) -> None:
    assert_faithful(narrative, plain_summary(narrative))


@settings(max_examples=400, deadline=None)
@given(st.text(max_size=400))
def test_property_arbitrary_text_is_faithful(narrative: str) -> None:
    out = plain_summary(narrative)
    if not narrative.strip():
        assert out is None
    assert_faithful(narrative, out)


@settings(max_examples=200, deadline=None)
@given(st.sampled_from([g["narrative"] for g in GOLDEN if g["narrative"]]), st.integers(0, 400))
def test_property_golden_prefixes_are_faithful(narrative: str, cut: int) -> None:
    source = narrative[:cut] or narrative
    assert_faithful(source, plain_summary(source))


@settings(max_examples=200, deadline=None)
@given(st.text(max_size=200))
def test_property_categorize_is_total_and_deterministic(desc: str) -> None:
    assert categorize(desc) == categorize(desc)
    code, title = parse_standard(desc)
    assert isinstance(code, str) and isinstance(title, str)
