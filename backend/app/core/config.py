from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_name: str = "SovereignForge"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_origin: str = "http://localhost:3000"

    database_url: str = (
        "postgresql+psycopg://sovereignforge:sovereignforge_dev@localhost:5432/sovereignforge"
    )
    qdrant_url: str = "http://localhost:6333"
    ollama_base_url: str = "http://localhost:11434"
    model_keep_alive: str = "2m"
    model_health_ttl_seconds: int = 30
    max_concurrent_model_requests: int = Field(default=1, ge=1, le=4)


@lru_cache
def get_settings() -> Settings:
    return Settings()

