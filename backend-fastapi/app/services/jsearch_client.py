from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(slots=True)
class JSearchApiError(Exception):
    message: str
    status_code: int


class JSearchClient:
    def __init__(
        self,
        *,
        api_key: str,
        rapidapi_host: str,
        base_url: str,
        timeout_seconds: float = 20.0,
    ) -> None:
        self._api_key = api_key
        self._rapidapi_host = rapidapi_host
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    async def search_jobs(self, *, query: str, page: int = 1, num_pages: int = 1) -> list[dict[str, Any]]:
        params = {
            "query": query,
            "page": str(page),
            "num_pages": str(num_pages),
        }

        headers = {
            "X-RapidAPI-Key": self._api_key,
            "X-RapidAPI-Host": self._rapidapi_host,
        }

        async with httpx.AsyncClient(timeout=self._timeout_seconds, headers=headers) as http:
            response = await http.get(f"{self._base_url}/search", params=params)

        self._raise_for_status(response)

        payload = response.json()
        if not isinstance(payload, dict):
            return []

        data = payload.get("data")
        if not isinstance(data, list):
            return []

        return [row for row in data if isinstance(row, dict)]

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.status_code < 400:
            return

        message = "JSearch request failed"
        status_code = response.status_code

        try:
            payload = response.json()
            if isinstance(payload, dict):
                message = str(payload.get("message") or payload.get("error") or message)
        except ValueError:
            if response.text:
                message = response.text

        if status_code < 400:
            status_code = 502
        raise JSearchApiError(message=message, status_code=status_code)
