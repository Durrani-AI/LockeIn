from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import AsyncGenerator

from fastapi import Header, HTTPException, status

from app.core.config import get_settings
from app.services.ai_pipeline import AiPipeline
from app.services.supabase_rest import SupabaseApiError, SupabaseRestClient


@dataclass(slots=True)
class RequestContext:
    user_id: str
    token: str
    supabase: SupabaseRestClient


async def get_request_context(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> AsyncGenerator[RequestContext, None]:
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

    settings = get_settings()
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

        yield RequestContext(user_id=user_id, token=token, supabase=supabase)
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
