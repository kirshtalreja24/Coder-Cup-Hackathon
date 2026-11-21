from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ROOT / ".env"), str(BACKEND / ".env")), extra="ignore", case_sensitive=False
    )
    app_name: str = "Bharosa (PROTOTYPE - not an official service)"
    env: str = "dev"
    # Postgres in prod (Supabase). SQLite fallback keeps local dev + tests friction-free.
    database_url: str = f"sqlite:///{BACKEND / 'bharosa.db'}"
    jwt_secret: str = "dev-only-change-me-in-production-please-32b"
    jwt_alg: str = "HS256"
    access_token_minutes: int = 60 * 8
    cors_origins: str = "*"
    upload_dir: str = str(BACKEND / "uploads")
    # Any OpenAI-compatible endpoint (OmniRoute, OpenRouter, Groq, ...). Optional: deterministic fallbacks exist.
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    llm_timeout_s: float = 12.0
    groq_api: str = ""
    groq_base_url: str = ""
    rate_limit_per_min: int = 120
    seed_on_start: bool = True


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.llm_api_key and s.groq_api:  # Groq is OpenAI-compatible: accept GROQ_API / GROQ_BASE_URL as the LLM config
        s.llm_api_key = s.groq_api
        s.llm_base_url = s.llm_base_url or s.groq_base_url or "https://api.groq.com/openai/v1"
        s.llm_model = s.llm_model or "openai/gpt-oss-120b"
    return s


def normalized_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url
