import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

from app.api.routes.auth import router as auth_router
from app.api.routes.ai import router as ai_router
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.core.config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject hardening headers into every backend response."""

    async def dispatch(
        self, request: StarletteRequest, call_next
    ) -> StarletteResponse:
        response: StarletteResponse = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        # API serves JSON only — no need to allow scripts or styles.
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        # Only set HSTS in production to avoid local dev issues.
        if get_settings().app_environment == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


settings = get_settings()

app = FastAPI(title=settings.app_name)

# Security headers middleware runs first (outermost).
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.app_allowed_origins,
    allow_origin_regex=settings.app_allowed_origins_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix=settings.app_api_prefix)
app.include_router(auth_router, prefix=settings.app_api_prefix)
app.include_router(ai_router, prefix=settings.app_api_prefix)
app.include_router(jobs_router, prefix=settings.app_api_prefix)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": settings.app_name, "status": "ok"}

