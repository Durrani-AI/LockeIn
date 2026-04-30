from __future__ import annotations

import secrets

from fastapi import APIRouter, Header, HTTPException, Response, status

from app.core.config import get_settings
from app.models.schemas import ClearSessionResponse, CreateSessionResponse
from app.services.supabase_rest import SupabaseApiError, SupabaseRestClient

router = APIRouter(prefix="/auth", tags=["auth"])


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: No authorization header provided",
        )

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

    return token


@router.post("/session", response_model=CreateSessionResponse)
async def create_session(
    response: Response,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> CreateSessionResponse:
    token = _parse_bearer_token(authorization)
    settings = get_settings()

    supabase = SupabaseRestClient(
        supabase_url=settings.supabase_url,
        api_key=settings.supabase_publishable_key,
        bearer_token=token,
    )

    try:
        user = await supabase.get_authenticated_user()
        user_id = str(user.get("id") or "").strip()
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: No user ID found in token",
            )
    except SupabaseApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    finally:
        await supabase.aclose()

    csrf_token = secrets.token_urlsafe(32)
    cookie_options = {
        "path": "/",
        "secure": settings.auth_cookie_secure,
        "samesite": settings.auth_cookie_samesite,
        "domain": settings.auth_cookie_domain,
        "max_age": settings.auth_cookie_max_age_seconds,
    }

    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        **cookie_options,
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        httponly=False,
        **cookie_options,
    )

    return CreateSessionResponse(userId=user_id, csrfToken=csrf_token)


@router.delete("/session", response_model=ClearSessionResponse)
async def clear_session(
    response: Response,
) -> ClearSessionResponse:
    settings = get_settings()

    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        domain=settings.auth_cookie_domain,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        path="/",
        domain=settings.auth_cookie_domain,
        secure=settings.auth_cookie_secure,
        httponly=False,
        samesite=settings.auth_cookie_samesite,
    )

    return ClearSessionResponse(cleared=True)
