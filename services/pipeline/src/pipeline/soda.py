"""Stage 1, extract: a small SODA client for data.texas.gov.

Full tables (activities, violations) come down as one CSV export ordered by row id, then the
row count is checked against the server's count(*). Operations come down as paged JSON so the
`:updated_at` system field is available for the incremental watermark.
"""

from __future__ import annotations

import csv
import io
import time
from collections.abc import Callable, Iterator
from typing import Any

import httpx
import structlog

from pipeline.config import SODA_BASE

log = structlog.get_logger()

RETRY_STATUS = frozenset({429, 500, 502, 503, 504})


class SodaError(RuntimeError):
    pass


class SodaClient:
    def __init__(
        self,
        app_token: str | None = None,
        *,
        base_url: str = SODA_BASE,
        client: httpx.Client | None = None,
        max_attempts: int = 5,
        backoff_s: float = 1.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        headers = {"X-App-Token": app_token} if app_token else {}
        self._http = client or httpx.Client(timeout=httpx.Timeout(120.0, connect=15.0))
        self._http.headers.update(headers)
        self._base = base_url
        self._max_attempts = max_attempts
        self._backoff_s = backoff_s
        self._sleep = sleep

    def close(self) -> None:
        self._http.close()

    def _get(self, dataset: str, fmt: str, params: dict[str, str]) -> httpx.Response:
        url = f"{self._base}{dataset}.{fmt}"
        last: str = ""
        for attempt in range(1, self._max_attempts + 1):
            try:
                resp = self._http.get(url, params=params)
            except httpx.TransportError as exc:
                last = f"{type(exc).__name__}: {exc}"
            else:
                if resp.status_code == 200:
                    return resp
                if resp.status_code not in RETRY_STATUS:
                    raise SodaError(f"{dataset}: HTTP {resp.status_code}: {resp.text[:300]}")
                last = f"HTTP {resp.status_code}"
            if attempt < self._max_attempts:
                delay = self._backoff_s * 2 ** (attempt - 1)
                log.warning("soda.retry", dataset=dataset, attempt=attempt, error=last, delay_s=delay)
                self._sleep(delay)
        raise SodaError(f"{dataset}: gave up after {self._max_attempts} attempts ({last})")

    def get_json(self, dataset: str, params: dict[str, str]) -> list[dict[str, Any]]:
        data = self._get(dataset, "json", params).json()
        if not isinstance(data, list):
            raise SodaError(f"{dataset}: expected a JSON array, got {type(data).__name__}")
        return data

    def count(self, dataset: str, where: str | None = None) -> int:
        params = {"$select": "count(*) as n"}
        if where:
            params["$where"] = where
        return int(self.get_json(dataset, params)[0]["n"])

    def iter_json_pages(
        self, dataset: str, params: dict[str, str], page_size: int = 50_000
    ) -> Iterator[dict[str, Any]]:
        offset = 0
        while True:
            page = self.get_json(
                dataset, {**params, "$order": ":id", "$limit": str(page_size), "$offset": str(offset)}
            )
            yield from page
            if len(page) < page_size:
                return
            offset += page_size

    def download_csv(self, dataset: str) -> list[dict[str, str]]:
        """The whole table as CSV rows. Fails if the row count disagrees with count(*)."""
        expected = self.count(dataset)
        resp = self._get(dataset, "csv", {"$order": ":id", "$limit": str(max(expected * 2, 1_000))})
        rows = list(csv.DictReader(io.StringIO(resp.text)))
        if len(rows) != expected:
            raise SodaError(f"{dataset}: downloaded {len(rows)} rows but the server counts {expected}")
        log.info("soda.downloaded", dataset=dataset, rows=len(rows), bytes=len(resp.content))
        return rows

    def operations(self, since: str | None = None) -> list[dict[str, Any]]:
        """Operations with their `:updated_at`, optionally only rows updated after `since`."""
        params = {"$select": "*, :updated_at"}
        if since:
            params["$where"] = f":updated_at > '{since}'"
        rows = list(self.iter_json_pages("bc5r-88dy", params))
        log.info("soda.downloaded", dataset="bc5r-88dy", rows=len(rows), since=since)
        return rows
