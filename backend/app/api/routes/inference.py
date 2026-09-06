from fastapi import APIRouter

from app.api.dependencies import AppSettings, DatabaseSession, OllamaProvider
from app.schemas.common import InferenceRequest, InferenceResponse
from app.services.model_registry import get_model, run_inference, select_general_model

router = APIRouter(prefix="/inference", tags=["inference"])


@router.post("/chat", response_model=InferenceResponse)
async def chat(
    request: InferenceRequest,
    session: DatabaseSession,
    provider: OllamaProvider,
    settings: AppSettings,
) -> InferenceResponse:
    model = (
        get_model(session, request.model_id)
        if request.model_id is not None
        else select_general_model(session)
    )
    content, duration_ms = await run_inference(
        model=model,
        prompt=request.prompt,
        provider=provider,
        keep_alive=settings.model_keep_alive,
    )
    return InferenceResponse(
        model_id=model.id,
        model_name=model.model_key,
        provider="ollama",
        content=content,
        duration_ms=duration_ms,
    )

