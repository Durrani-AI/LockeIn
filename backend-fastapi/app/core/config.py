from functools import lru_cache
import json

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="LockedIn API", alias="APP_NAME")
    app_environment: str = Field(default="development", alias="APP_ENVIRONMENT")
    app_api_prefix: str = Field(default="/api/v1", alias="APP_API_PREFIX")
    app_allowed_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080", "http://localhost:5173"],
        alias="APP_ALLOWED_ORIGINS",
    )

    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_publishable_key: str = Field(alias="SUPABASE_PUBLISHABLE_KEY")
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")

    rapidapi_key: str | None = Field(default=None, alias="RAPIDAPI_KEY")
    jsearch_rapidapi_host: str = Field(default="jsearch.p.rapidapi.com", alias="JSEARCH_RAPIDAPI_HOST")
    jsearch_base_url: str = Field(default="https://jsearch.p.rapidapi.com", alias="JSEARCH_BASE_URL")
    jsearch_default_query: str = Field(
        default="graduate internship opportunities united kingdom",
        alias="JSEARCH_DEFAULT_QUERY",
    )
    jsearch_default_num_pages: int = Field(default=1, ge=1, le=5, alias="JSEARCH_DEFAULT_NUM_PAGES")
    jsearch_max_num_pages: int = Field(default=3, ge=1, le=10, alias="JSEARCH_MAX_NUM_PAGES")
    jsearch_timeout_seconds: float = Field(default=20.0, ge=5.0, le=60.0, alias="JSEARCH_TIMEOUT_SECONDS")

    groq_api_key: str | None = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    sentence_transformer_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        alias="SENTENCE_TRANSFORMER_MODEL",
    )

    auth_cookie_name: str = Field(default="lockedin_access_token", alias="APP_AUTH_COOKIE_NAME")
    csrf_cookie_name: str = Field(default="lockedin_csrf_token", alias="APP_CSRF_COOKIE_NAME")
    auth_cookie_secure: bool = Field(default=False, alias="APP_AUTH_COOKIE_SECURE")
    auth_cookie_samesite: str = Field(default="lax", alias="APP_AUTH_COOKIE_SAMESITE")
    auth_cookie_domain: str | None = Field(default=None, alias="APP_AUTH_COOKIE_DOMAIN")
    auth_cookie_max_age_seconds: int = Field(default=3600, alias="APP_AUTH_COOKIE_MAX_AGE_SECONDS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("app_allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]

            return [item.strip() for item in raw.split(",") if item.strip()]
        if isinstance(value, list):
            return [str(item) for item in value]
        return []

    @field_validator("auth_cookie_samesite", mode="before")
    @classmethod
    def parse_cookie_samesite(cls, value: object) -> str:
        parsed = str(value).strip().lower() if value is not None else "lax"
        if parsed not in {"lax", "strict", "none"}:
            return "lax"
        return parsed


@lru_cache
def get_settings() -> Settings:
    return Settings()
