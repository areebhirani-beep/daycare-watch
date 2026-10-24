"""Extract tests against recorded real responses (no network)."""

from __future__ import annotations

import httpx
import pytest

from pipeline.soda import SodaClient, SodaError
from tests.conftest import FIXTURES


def client(handler: httpx.MockTransport, **kw: object) -> SodaClient:
    return SodaClient(client=httpx.Client(transport=handler), sleep=lambda _s: None, **kw)  # type: ignore[arg-type]


def test_retries_then_succeeds() -> None:
    calls: list[int] = []
    page = (FIXTURES / "recorded" / "operations_page.json").read_text()

    def handle(req: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) < 3:
            return httpx.Response(429 if len(calls) == 1 else 503)
        return httpx.Response(200, text=page)

    rows = client(httpx.MockTransport(handle)).get_json("bc5r-88dy", {})
    assert len(calls) == 3
    assert len(rows) == 3 and ":updated_at" in rows[0]


def test_transport_errors_give_up() -> None:
    def handle(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=req)

    with pytest.raises(SodaError, match="gave up after 2"):
        client(httpx.MockTransport(handle), max_attempts=2).get_json("x", {})


def test_bad_query_fails_fast() -> None:
    body = (FIXTURES / "recorded" / "error_400.json").read_text()
    calls: list[int] = []

    def handle(req: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(400, text=body)

    with pytest.raises(SodaError, match="HTTP 400"):
        client(httpx.MockTransport(handle)).get_json("bc5r-88dy", {})
    assert calls == [1]


def test_app_token_header_sent() -> None:
    seen: dict[str, str] = {}

    def handle(req: httpx.Request) -> httpx.Response:
        seen.update(req.headers)
        return httpx.Response(200, json=[])

    client(httpx.MockTransport(handle), app_token="tok").get_json("x", {})
    assert seen["x-app-token"] == "tok"


def test_paging_stops_on_short_page() -> None:
    offsets: list[str] = []

    def handle(req: httpx.Request) -> httpx.Response:
        offsets.append(req.url.params["$offset"])
        n = 2 if req.url.params["$offset"] == "0" else 1
        return httpx.Response(200, json=[{"i": i} for i in range(n)])

    rows = list(client(httpx.MockTransport(handle)).iter_json_pages("x", {}, page_size=2))
    assert offsets == ["0", "2"] and len(rows) == 3


def test_csv_download_checks_count() -> None:
    csv_text = (FIXTURES / "violations.csv").read_text()
    count = (FIXTURES / "recorded" / "violations_count.json").read_text()

    def handle(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith(".json"):
            return httpx.Response(200, text=count)
        return httpx.Response(200, text=csv_text)

    rows = client(httpx.MockTransport(handle)).download_csv("tqgd-mf4x")
    assert len(rows) == 446

    def short(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith(".json"):
            return httpx.Response(200, text=count)
        return httpx.Response(200, text=csv_text.split("\n", 1)[0] + "\n")

    with pytest.raises(SodaError, match="downloaded 0 rows"):
        client(httpx.MockTransport(short)).download_csv("tqgd-mf4x")


def test_non_array_json_fails() -> None:
    with pytest.raises(SodaError, match="expected a JSON array"):
        client(httpx.MockTransport(lambda r: httpx.Response(200, json={"a": 1}))).get_json("x", {})


def test_operations_since_filter() -> None:
    seen: list[str] = []

    def handle(req: httpx.Request) -> httpx.Response:
        seen.append(req.url.params.get("$where", ""))
        return httpx.Response(200, json=[])

    client(httpx.MockTransport(handle)).operations(since="2026-10-24T09:08:01")
    assert seen == [":updated_at > '2026-10-24T09:08:01'"]
