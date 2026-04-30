from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import secrets
from typing import AsyncGenerator, Literal

from fastapi import Depends, Header, HTTPException, Request, Response, status

from app.core.config import get_settings
from app.services.ai_pipeline import AiPipeline
from app.services.rate_limiter import InMemoryRateLimiter
from app.services.supabase_rest import SupabaseApiError, SupabaseRestClient


UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@dataclass(slots=True)
class RequestContext:
    user_id: str
    token: str
    supabase: SupabaseRestClient
    auth_source: Literal["header", "cookie"]


def _extract_token(
    *,
    authorization: str | None,
    request: Request,
    auth_cookie_name: str,
) -> tuple[str, Literal["header", "cookie"]]:
    if authorization is not None:
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Only Bearer tokens are supported",
            )

        token = authorization.replace("Bearer ", "", 1).strip()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: No token provided",
            )

        return token, "header"

    cookie_token = request.cookies.get(auth_cookie_name, "").strip()
    if cookie_token:
        return cookie_token, "cookie"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: No authorization token provided",
    )


def _enforce_csrf_for_cookie_auth(
    *,
    request: Request,
    auth_source: Literal["header", "cookie"],
    csrf_cookie_name: str,
    x_csrf_token: str | None,
) -> None:
    if auth_source != "cookie":
        return
    if request.method.upper() not in UNSAFE_METHODS:
        return

    csrf_cookie = request.cookies.get(csrf_cookie_name, "")
    csrf_header = (x_csrf_token or "").strip()

    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed",
        )


async def get_request_context(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> AsyncGenerator[RequestContext, None]:
    settings = get_settings()

    token, auth_source = _extract_token(
        authorization=authorization,
        request=request,
        auth_cookie_name=settings.auth_cookie_name,
    )
    _enforce_csrf_for_cookie_auth(
        request=request,
        auth_source=auth_source,
        csrf_cookie_name=settings.csrf_cookie_name,
        x_csrf_token=x_csrf_token,
    )

    supabase = SupabaseRestClient(
        supabase_url=settings.supabase_url,
        api_key=settings.supabase_publishable_key,
        bearer_token=token,
    )

    try:
        user = await supabase.get_authenticated_user()
        user_id = str(user.get("id", "")).strip()
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: No user ID found in token",
            )

        yield RequestContext(user_id=user_id, token=token, supabase=supabase, auth_source=auth_source)
    except SupabaseApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    finally:
        await supabase.aclose()


@lru_cache
def get_ai_pipeline() -> AiPipeline:
    settings = get_settings()
    return AiPipeline(
        groq_api_key=settings.groq_api_key,
        groq_model=settings.groq_model,
        sentence_transformer_model=settings.sentence_transformer_model,
    )


@lru_cache
def get_rate_limiter() -> InMemoryRateLimiter:
    return InMemoryRateLimiter()


def rate_limit(*, limit: int, window_seconds: int):
    async def dependency(
        request: Request,
        response: Response,
        ctx: RequestContext = Depends(get_request_context),
    ) -> None:
        limiter = get_rate_limiter()
        key = f"{ctx.user_id}:{request.url.path}"
        decision = limiter.evaluate(key=key, limit=limit, window_seconds=window_seconds)

        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
        response.headers["X-RateLimit-Window"] = str(window_seconds)

        if not decision.allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Retry in {decision.retry_after_seconds} seconds.",
                headers={"Retry-After": str(decision.retry_after_seconds)},
            )

    return dependency
