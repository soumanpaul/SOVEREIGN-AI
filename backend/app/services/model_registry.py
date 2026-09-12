import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import ModelHealthRecord, RegisteredModel
from app.model_providers.base import ChatRequest
from app.model_providers.ollama import OllamaModelProvider
from app.schemas.common import ModelHealth, ModelResponse


def _latest_health(model: RegisteredModel) -> ModelHealth | None:
    if not model.health_records:
        return None
    record = max(model.health_records, key=lambda item: item.observed_at)
    status = record.status if record.status in {"ready", "unavailable", "unknown"} else "unknown"
    return ModelHealth(
        status=status,
        observed_at=record.observed_at,
        latency_ms=record.latency_ms,
        details=record.details,
    )


def to_response(model: RegisteredModel) -> ModelResponse:
    return ModelResponse(
        id=model.id,
        name=model.name,
        provider=model.provider,
        model_key=model.model_key,
        capabilities=model.capabilities,
        context_window=model.context_window,
        quantization=model.quantization,
        priority=model.priority,
        enabled=model.enabled,
        latest_health=_latest_health(model),
    )


def list_models(session: Session) -> list[ModelResponse]:
    statement = (
        select(RegisteredModel)
        .where(RegisteredModel.enabled.is_(True))
        .order_by(RegisteredModel.priority.desc(), RegisteredModel.name)
    )
    return [to_response(model) for model in session.scalars(statement).unique().all()]


def get_model(session: Session, model_id: uuid.UUID) -> RegisteredModel:
    model = session.get(RegisteredModel, model_id)
    if model is None or not model.enabled:
        raise AppError("MODEL_NOT_FOUND", "The requested model is not available.", 404)
    return model


def select_general_model(session: Session) -> RegisteredModel:
    statement = (
        select(RegisteredModel)
        .where(RegisteredModel.enabled.is_(True))
        .order_by(RegisteredModel.priority.desc(), RegisteredModel.model_key)
    )
    models = session.scalars(statement).all()
    model = next((item for item in models if "general" in item.capabilities), None)
    if model is None:
        raise AppError("NO_GENERAL_MODEL", "No enabled general model is configured.", 503)
    return model


async def check_model_health(
    session: Session, model: RegisteredModel, provider: OllamaModelProvider
) -> ModelResponse:
    try:
        result = await provider.health(model.model_key)
        status = "ready" if result.ready else "unavailable"
        details = result.details
        latency_ms = result.latency_ms
    except AppError as exc:
        status = "unavailable"
        details = {"error_code": exc.code, "provider_reachable": False}
        latency_ms = None

    record = ModelHealthRecord(
        model_id=model.id,
        status=status,
        observed_at=datetime.now(UTC),
        latency_ms=latency_ms,
        details=details,
    )
    session.add(record)
    session.commit()
    session.refresh(model)
    return to_response(model)


async def run_inference(
    model: RegisteredModel,
    prompt: str,
    provider: OllamaModelProvider,
    keep_alive: str,
) -> tuple[str, int]:
    if "embedding" in model.capabilities and "text" not in model.capabilities:
        raise AppError("MODEL_NOT_GENERATIVE", "The selected model cannot generate text.", 422)
    result = await provider.chat(
        ChatRequest(model_key=model.model_key, prompt=prompt, keep_alive=keep_alive)
    )
    return result.content, result.duration_ms
