from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_name: str = "SOVEREIGN AI"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_origin: str = "http://localhost:3000"
    auth_cookie_name: str = "sovereignforge_session"
    auth_session_hours: int = Field(default=24 * 7, ge=1, le=24 * 90)

    database_url: str = (
        "postgresql+psycopg://sovereignforge:sovereignforge_dev@localhost:5432/sovereignforge"
    )
    qdrant_url: str = "http://localhost:6333"
    ollama_base_url: str = "http://localhost:11434"
    model_keep_alive: str = "2m"
    model_health_ttl_seconds: int = 30
    max_concurrent_model_requests: int = Field(default=1, ge=1, le=4)
    data_root: Path = Path("data")
    max_upload_bytes: int = Field(default=20 * 1024 * 1024, ge=1024)
    max_pdf_pages: int = Field(default=100, ge=1, le=500)
    ocr_text_threshold: int = Field(default=40, ge=0)
    qdrant_collection: str = "sovereignforge_chunks"
    chunk_size_chars: int = Field(default=2800, ge=500)
    chunk_overlap_chars: int = Field(default=400, ge=0)
    embedding_model: str = "nomic-embed-text"


@lru_cache
def get_settings() -> Settings:
    return Settings()
