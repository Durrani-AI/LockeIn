from __future__ import annotations

from datetime import datetime
import hashlib
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import rate_limit
from app.core.config import get_settings
from app.core.sanitization import sanitize_external_url, sanitize_text
from app.models.schemas import SyncJobsRequest, SyncJobsResponse, SyncedJob
from app.services.jobs_catalog import JobsCatalogError, JobsCatalogService
from app.services.jsearch_client import JSearchApiError, JSearchClient

router = APIRouter(tags=["jobs"])


def _parse_iso_datetime(value: object) -> datetime | None:
    raw = sanitize_text(value, max_length=64, preserve_newlines=False)
    if not raw:
        return None

    normalized = raw.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _infer_job_type(title: str, description: str, employment_type: str | None) -> str:
    haystack = f"{title} {description} {employment_type or ''}".lower()

    if "placement" in haystack or "year in industry" in haystack:
        return "placement"
    if "intern" in haystack or "internship" in haystack or "summer analyst" in haystack:
        return "internship"
    return "graduate"


def _infer_category(title: str, description: str, company: str) -> str:
    haystack = f"{title} {description} {company}".lower()

    finance_terms = (
        "finance",
        "bank",
        "banking",
        "asset management",
        "trading",
        "markets",
        "investment",
        "risk",
    )
    law_terms = (
        "law",
        "legal",
        "solicitor",
        "paralegal",
        "consulting",
        "consultant",
        "compliance",
    )
    technology_terms = (
        "software",
        "technology",
        "engineer",
        "developer",
        "data",
        "cloud",
        "cyber",
        "ai",
        "machine learning",
    )

    if any(term in haystack for term in finance_terms):
        return "finance"
    if any(term in haystack for term in law_terms):
        return "law"
    if any(term in haystack for term in technology_terms):
        return "technology"
    return "graduate"


def _compose_location(raw_job: dict[str, Any]) -> str:
    city = sanitize_text(raw_job.get("job_city"), max_length=80, preserve_newlines=False)
    state = sanitize_text(raw_job.get("job_state"), max_length=80, preserve_newlines=False)
    country = sanitize_text(raw_job.get("job_country"), max_length=80, preserve_newlines=False)

    parts = [part for part in (city, state, country) if part]
    location = ", ".join(parts) if parts else "Location not specified"

    if bool(raw_job.get("job_is_remote")):
        return "Remote" if not parts else f"{location} (Remote option)"
    return location


def _extract_requirements(raw_job: dict[str, Any]) -> str | None:
    highlights = raw_job.get("job_highlights")
    if not isinstance(highlights, dict):
        return None

    qualifications = highlights.get("Qualifications")
    if not isinstance(qualifications, list):
        return None

    items: list[str] = []
    for item in qualifications:
        sanitized = sanitize_text(item, max_length=300, preserve_newlines=False)
        if sanitized:
            items.append(sanitized)

    if not items:
        return None

    return "\n".join(f"- {item}" for item in items)


def _format_salary(raw_job: dict[str, Any]) -> str | None:
    minimum = raw_job.get("job_min_salary")
    maximum = raw_job.get("job_max_salary")
    currency = sanitize_text(raw_job.get("job_salary_currency"), max_length=8, preserve_newlines=False)
    period = sanitize_text(raw_job.get("job_salary_period"), max_length=40, preserve_newlines=False)

    if minimum in (None, "") and maximum in (None, ""):
        return None

    def as_number(value: object) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    min_value = as_number(minimum)
    max_value = as_number(maximum)

    symbol = currency or ""
    if min_value is not None and max_value is not None:
        core = f"{symbol}{min_value:,.0f} - {symbol}{max_value:,.0f}" if symbol else f"{min_value:,.0f} - {max_value:,.0f}"
    elif min_value is not None:
        core = f"From {symbol}{min_value:,.0f}" if symbol else f"From {min_value:,.0f}"
    elif max_value is not None:
        core = f"Up to {symbol}{max_value:,.0f}" if symbol else f"Up to {max_value:,.0f}"
    else:
        return None

    if period:
        return f"{core} / {period}"
    return core


def _normalize_jsearch_job(raw_job: dict[str, Any]) -> dict[str, Any] | None:
    role_title = sanitize_text(raw_job.get("job_title"), max_length=180, preserve_newlines=False)
    company = sanitize_text(raw_job.get("employer_name"), max_length=180, preserve_newlines=False)
    description = sanitize_text(raw_job.get("job_description"), max_length=20_000)

    if not role_title or not company or not description:
        return None

    apply_url = sanitize_external_url(raw_job.get("job_apply_link"))
    requirements = _extract_requirements(raw_job)

    highlights = raw_job.get("job_highlights")
    summary = None
    if isinstance(highlights, dict):
        responsibilities = highlights.get("Responsibilities")
        if isinstance(responsibilities, list) and responsibilities:
            summary = sanitize_text(responsibilities[0], max_length=320)

    short_summary = summary or sanitize_text(description, max_length=320)
    if not short_summary:
        short_summary = f"{role_title} at {company}"

    external_id = sanitize_text(raw_job.get("job_id"), max_length=128, preserve_newlines=False)
    if not external_id:
        fingerprint_source = "|".join(
            [
                company,
                role_title,
                apply_url or "",
                sanitize_text(raw_job.get("job_posted_at_datetime_utc"), max_length=64, preserve_newlines=False) or "",
            ]
        )
        external_id = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()[:40]

    employment_type = sanitize_text(raw_job.get("job_employment_type"), max_length=40, preserve_newlines=False)
    category = _infer_category(role_title, description, company)
    job_type = _infer_job_type(role_title, description, employment_type)

    deadline_dt = _parse_iso_datetime(raw_job.get("job_offer_expiration_datetime_utc"))
    posted_at_dt = _parse_iso_datetime(raw_job.get("job_posted_at_datetime_utc"))

    payload = {
        "external_source": "jsearch",
        "external_id": external_id,
        "company": company,
        "role_title": role_title,
        "category": category,
        "job_type": job_type,
        "location": _compose_location(raw_job),
        "deadline": deadline_dt.date().isoformat() if deadline_dt else None,
        "short_summary": short_summary,
        "description": description,
        "requirements": requirements,
        "apply_url": apply_url,
        "salary": _format_salary(raw_job),
        "posted_at": posted_at_dt.isoformat() if posted_at_dt else None,
        "source_payload": {
            "provider": "jsearch",
            "job_id": external_id,
            "employment_type": employment_type,
            "is_remote": bool(raw_job.get("job_is_remote")),
        },
    }

    return payload


@router.post("/jobs/sync", response_model=SyncJobsResponse)
async def sync_jobs(
    payload: SyncJobsRequest,
    _: None = Depends(rate_limit(limit=4, window_seconds=60)),
) -> SyncJobsResponse:
    settings = get_settings()

    if not settings.rapidapi_key:
        raise HTTPException(
            status_code=503,
            detail="RAPIDAPI_KEY is not configured on the backend.",
        )

    if not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_SERVICE_ROLE_KEY is required to sync jobs into the catalog.",
        )

    explicit_query = None
    if payload.query is not None:
        explicit_query = sanitize_text(payload.query, max_length=180, preserve_newlines=False)
        if not explicit_query:
            raise HTTPException(status_code=400, detail="A search query is required.")

    if explicit_query:
        queries = [explicit_query]
    else:
        queries = [
            sanitize_text(candidate, max_length=180, preserve_newlines=False)
            for candidate in settings.jsearch_default_queries
        ]
        queries = [candidate for candidate in queries if candidate]

        if not queries:
            fallback_query = sanitize_text(
                settings.jsearch_default_query,
                max_length=180,
                preserve_newlines=False,
            )
            if fallback_query:
                queries = [fallback_query]

    if not queries:
        raise HTTPException(status_code=400, detail="At least one valid search query is required.")

    page = payload.page or 1
    requested_pages = payload.numPages or settings.jsearch_default_num_pages
    num_pages = min(max(1, requested_pages), max(1, settings.jsearch_max_num_pages))

    client = JSearchClient(
        api_key=settings.rapidapi_key,
        rapidapi_host=settings.jsearch_rapidapi_host,
        base_url=settings.jsearch_base_url,
        timeout_seconds=settings.jsearch_timeout_seconds,
    )

    try:
        fetched_rows: list[dict[str, Any]] = []
        for query in queries:
            rows = await client.search_jobs(
                query=query,
                page=page,
                num_pages=num_pages,
            )
            fetched_rows.extend(rows)
    except JSearchApiError as exc:
        status_code = exc.status_code if 400 <= exc.status_code < 600 else 502
        raise HTTPException(status_code=status_code, detail=exc.message) from exc

    normalized_rows: list[dict[str, Any]] = []
    seen_external_ids: set[str] = set()

    for row in fetched_rows:
        normalized = _normalize_jsearch_job(row)
        if not normalized:
            continue

        external_id = str(normalized.get("external_id", ""))
        if not external_id or external_id in seen_external_ids:
            continue

        seen_external_ids.add(external_id)
        normalized_rows.append(normalized)

    catalog = JobsCatalogService(
        supabase_url=settings.supabase_url,
        service_role_key=settings.supabase_service_role_key,
        timeout_seconds=settings.jsearch_timeout_seconds,
    )

    try:
        upserted_rows = await catalog.upsert_jobs(normalized_rows)
    except JobsCatalogError as exc:
        status_code = exc.status_code if 400 <= exc.status_code < 600 else 500
        raise HTTPException(status_code=status_code, detail=exc.message) from exc

    jobs: list[SyncedJob] = []
    for row in upserted_rows:
        row_id = sanitize_text(row.get("id"), max_length=64, preserve_newlines=False)
        role_title = sanitize_text(row.get("role_title"), max_length=180, preserve_newlines=False)
        company = sanitize_text(row.get("company"), max_length=180, preserve_newlines=False)
        location = sanitize_text(row.get("location"), max_length=180, preserve_newlines=False)
        if not row_id or not role_title or not company or not location:
            continue

        jobs.append(
            SyncedJob(
                id=row_id,
                roleTitle=role_title,
                company=company,
                location=location,
                applyUrl=sanitize_external_url(row.get("apply_url")),
            )
        )

    query_label = explicit_query or f"{len(queries)} default market queries"

    return SyncJobsResponse(
        query=query_label,
        fetched=len(fetched_rows),
        imported=len(upserted_rows),
        jobs=jobs,
    )
