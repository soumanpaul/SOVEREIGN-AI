from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.model_providers.ollama import OllamaModelProvider

DatabaseSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def get_ollama_provider(settings: AppSettings) -> OllamaModelProvider:
    return OllamaModelProvider(settings.ollama_base_url)


OllamaProvider = Annotated[OllamaModelProvider, Depends(get_ollama_provider)]
