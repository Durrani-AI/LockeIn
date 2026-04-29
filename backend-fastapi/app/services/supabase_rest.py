from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx


@dataclass(slots=True)
class SupabaseApiError(Exception):
    message: str
    status_code: int


class SupabaseRestClient:
    def __init__(self, supabase_url: str, api_key: str, bearer_token: str) -> None:
        base_url = supabase_url.rstrip("/")
        self._rest_base = f"{base_url}/rest/v1"
        self._auth_base = f"{base_url}/auth/v1"
        self._storage_base = f"{base_url}/storage/v1"

        self._http = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "apikey": api_key,
                "Authorization": f"Bearer {bearer_token}",
            },
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def get_authenticated_user(self) -> dict[str, Any]:
        response = await self._http.get(f"{self._auth_base}/user")
        self._raise_for_status(response, "Unauthorized: Invalid token", 401)

        data = response.json()
        if not isinstance(data, dict) or not data.get("id"):
            raise SupabaseApiError("Unauthorized: No user ID found in token", 401)
        return data

    async def fetch_cv_by_id(self, cv_id: str) -> dict[str, Any] | None:
        rows = await self._select(
            "cvs",
            {
                "select": "id,storage_path,user_id",
                "id": f"eq.{cv_id}",
                "limit": "1",
            },
            "CV lookup failed",
        )
        return rows[0] if rows else None

    async def fetch_latest_cv(self, user_id: str) -> dict[str, Any] | None:
        rows = await self._select(
            "cvs",
            {
                "select": "id,user_id,extracted_text",
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
                "limit": "1",
            },
            "CV lookup failed",
        )
        return rows[0] if rows else None

    async def fetch_job(self, job_id: str) -> dict[str, Any] | None:
        rows = await self._select(
            "jobs",
            {
                "select": "*",
                "id": f"eq.{job_id}",
                "limit": "1",
            },
            "Job lookup failed",
        )
        return rows[0] if rows else None

    async def fetch_communication_profile(self, user_id: str) -> dict[str, Any] | None:
        rows = await self._select(
            "communication_profiles",
            {
                "select": "*",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
            "Communication profile lookup failed",
        )
        return rows[0] if rows else None

    async def fetch_user_profile(self, user_id: str) -> dict[str, Any] | None:
        rows = await self._select(
            "profiles",
            {
                "select": "display_name",
                "id": f"eq.{user_id}",
                "limit": "1",
            },
            "User profile lookup failed",
        )
        return rows[0] if rows else None

    async def download_cv_file(self, storage_path: str) -> bytes:
        encoded_path = quote(storage_path, safe="/")
        response = await self._http.get(f"{self._storage_base}/object/cvs/{encoded_path}")
        self._raise_for_status(response, "Could not download CV file", 400)
        return response.content

    async def update_cv_text(self, cv_id: str, extracted_text: str) -> None:
        response = await self._http.patch(
            f"{self._rest_base}/cvs",
            params={"id": f"eq.{cv_id}"},
            json={"extracted_text": extracted_text},
            headers={"Prefer": "return=minimal"},
        )
        self._raise_for_status(response, "Could not save extracted text", 500)

    async def insert_cv_advice(self, payload: dict[str, Any]) -> str | None:
        rows = await self._insert("cv_advice", payload, "Could not save CV advice")
        if not rows:
            return None
        advice_id = rows[0].get("id")
        return str(advice_id) if advice_id else None

    async def insert_cover_letter(self, payload: dict[str, Any]) -> str:
        rows = await self._insert("cover_letters", payload, "Could not save the letter")
        if not rows or not rows[0].get("id"):
            raise SupabaseApiError("Could not save the letter", 500)
        return str(rows[0]["id"])

    async def _select(
        self,
        table: str,
        params: dict[str, str],
        error_message: str,
    ) -> list[dict[str, Any]]:
        response = await self._http.get(f"{self._rest_base}/{table}", params=params)
        self._raise_for_status(response, error_message, 500)

        data = response.json()
        if isinstance(data, list):
            return [row for row in data if isinstance(row, dict)]
        if isinstance(data, dict):
            return [data]
        return []

    async def _insert(self, table: str, payload: dict[str, Any], error_message: str) -> list[dict[str, Any]]:
        response = await self._http.post(
            f"{self._rest_base}/{table}",
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        self._raise_for_status(response, error_message, 500)

        data = response.json()
        if isinstance(data, list):
            return [row for row in data if isinstance(row, dict)]
        if isinstance(data, dict):
            return [data]
        return []

    @staticmethod
    def _raise_for_status(response: httpx.Response, fallback_message: str, fallback_code: int) -> None:
        if response.status_code < 400:
            return

        message = fallback_message
        status_code = fallback_code

        try:
            payload = response.json()
            if isinstance(payload, dict):
                message = str(payload.get("message") or payload.get("error") or payload.get("hint") or fallback_message)
        except ValueError:
            if response.text:
                message = response.text

        if response.status_code in (400, 401, 403, 404, 409, 422):
            status_code = response.status_code
        raise SupabaseApiError(message, status_code)
