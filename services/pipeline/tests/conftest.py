from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

import pytest

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


def read_csv(name: str) -> list[dict[str, str]]:
    with (FIXTURES / name).open(newline="") as f:
        return list(csv.DictReader(f))


@pytest.fixture
def ops_raw() -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = json.loads((FIXTURES / "operations.json").read_text())
    return data


@pytest.fixture
def acts_raw() -> list[dict[str, str]]:
    return read_csv("activities.csv")


@pytest.fixture
def viols_raw() -> list[dict[str, str]]:
    return read_csv("violations.csv")
