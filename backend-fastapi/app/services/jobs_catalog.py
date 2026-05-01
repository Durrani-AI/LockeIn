from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(slots=True)
class JobsCatalogError(Exception):
    message: str
    status_code: int


class JobsCatalogService:
    def __init__(self, *, supabase_url: str, service_role_key: str, timeout_seconds: float = 20.0) -> None:
        base_url = supabase_url.rstrip("/")
        self._rest_base = f"{base_url}/rest/v1"
        self._timeout_seconds = timeout_seconds
        self._headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        }

    async def upsert_jobs(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not rows:
            return []

        async with httpx.AsyncClient(timeout=self._timeout_seconds, headers=self._headers) as http:
            response = await http.post(
                f"{self._rest_base}/jobs",
                params={"on_conflict": "external_source,external_id"},
                headers={"Prefer": "resolution=merge-duplicates,return=representation"},
                json=rows,
            )

        self._raise_for_status(response)

        payload = response.json()
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, dict)]
        if isinstance(payload, dict):
            return [payload]
        return []

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.status_code < 400:
            return

        message = "Could not upsert jobs"
        status_code = response.status_code if response.status_code >= 400 else 500

        try:
            payload = response.json()
            if isinstance(payload, dict):
                message = str(payload.get("message") or payload.get("error") or payload.get("hint") or message)
        except ValueError:
            if response.text:
                message = response.text

        raise JobsCatalogError(message=message, status_code=status_code)
