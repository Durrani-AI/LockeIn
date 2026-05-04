from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.ai import router as ai_router
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

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
