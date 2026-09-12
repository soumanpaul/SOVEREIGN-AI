from uuid import UUID

from fastapi import APIRouter

from app.api.dependencies import DatabaseSession, OllamaProvider
from app.schemas.common import ModelResponse
from app.services.model_registry import check_model_health, get_model, list_models

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=list[ModelResponse])
def models(session: DatabaseSession) -> list[ModelResponse]:
    return list_models(session)


@router.post("/{model_id}/health-check", response_model=ModelResponse)
async def model_health(
    model_id: UUID, session: DatabaseSession, provider: OllamaProvider
) -> ModelResponse:
    model = get_model(session, model_id)
    return await check_model_health(session, model, provider)
