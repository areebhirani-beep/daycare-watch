"""Runtime configuration, read from the environment only. No secrets live in code."""

from __future__ import annotations

import os
from dataclasses import dataclass

SODA_BASE = "https://data.texas.gov/resource/"

OPERATIONS = "bc5r-88dy"
ACTIVITIES = "m5q4-3y3d"
VIOLATIONS = "tqgd-mf4x"

# CONTRACT section 3: daycare operation types. Foster and residential types are out of scope.
IN_SCOPE_TYPES = frozenset(
    {
        "Licensed Center",
        "Licensed Child-Care Home",
        "Listed Family Home",
        "Registered Child-Care Home",
    }
)

OFFICIAL_URL = "https://childcare.hhs.texas.gov/Public/OperationDetails?operationId={operation_id}"

MIN_JOIN_RATE = 0.95


@dataclass(frozen=True)
class Settings:
    database_url: str | None
    soda_app_token: str | None
    expo_access_token: str | None

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            database_url=os.environ.get("DATABASE_URL") or None,
            soda_app_token=os.environ.get("SODA_APP_TOKEN") or None,
            expo_access_token=os.environ.get("EXPO_ACCESS_TOKEN") or None,
        )

    def require_db(self) -> str:
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is not set")
        return self.database_url
