from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import RegisteredModel
from app.model_providers.ollama import OllamaModelProvider


@dataclass(frozen=True, slots=True)
class Classification:
    task_type: str
    capabilities: list[str]
    agent_profile: str
    reasons: list[str]


@dataclass(frozen=True, slots=True)
class RouteDecision:
    model: RegisteredModel
    data: dict[str, object]


def classify_task(
    goal: str, has_files: bool, has_knowledge: bool, requested_mode: str = "auto"
) -> Classification:
    normalized = goal.casefold()
    coding = any(word in normalized for word in ("code", "bug", "fix", "test", "repository"))
    spreadsheet = any(
        word in normalized for word in ("spreadsheet", "quotation", "vendor", "compare")
    )
    document = has_files or any(word in normalized for word in ("document", "pdf", "inspection"))
    rag = has_knowledge or any(
        word in normalized for word in ("policy", "sop", "manual", "knowledge")
    )
    if requested_mode == "coding" or coding:
        return Classification("coding", ["text", "coding"], "coding_agent", ["coding intent"])
    if spreadsheet:
        return Classification(
            "spreadsheet", ["text", "reasoning"], "procurement_agent", ["comparison intent"]
        )
    if rag:
        return Classification(
            "rag", ["text", "reasoning"], "document_agent", ["knowledge base supplied"]
        )
    if requested_mode == "document" or document:
        return Classification(
            "document_analysis", ["text", "reasoning"], "document_agent", ["files supplied"]
        )
    return Classification("general", ["text", "reasoning"], "general_agent", ["default route"])


async def route_model(
    session: Session, classification: Classification, provider: OllamaModelProvider
) -> RouteDecision:
    candidates = list(
        session.scalars(
            select(RegisteredModel)
            .where(RegisteredModel.enabled.is_(True))
            .order_by(RegisteredModel.priority.desc(), RegisteredModel.model_key)
        )
    )
    evaluated: list[dict[str, object]] = []
    selected: RegisteredModel | None = None
    for candidate in candidates:
        missing = sorted(set(classification.capabilities) - set(candidate.capabilities))
        record: dict[str, object] = {
            "model_id": str(candidate.id),
            "model_key": candidate.model_key,
            "priority": candidate.priority,
            "missing_capabilities": missing,
            "eligible": False,
        }
        if not missing:
            health = await provider.health(candidate.model_key)
            record["health"] = "ready" if health.ready else "unavailable"
            record["latency_ms"] = health.latency_ms
            record["eligible"] = health.ready
            if health.ready and selected is None:
                selected = candidate
        evaluated.append(record)
    if selected is None:
        raise AppError(
            "NO_CAPABLE_MODEL", "No healthy local model covers the task capabilities.", 503, True
        )
    return RouteDecision(
        selected,
        {
            "task_type": classification.task_type,
            "required_capabilities": classification.capabilities,
            "classification_reasons": classification.reasons,
            "candidates": evaluated,
            "selected_model_id": str(selected.id),
            "selected_model_key": selected.model_key,
            "selection_reason": "highest-priority healthy model covering every capability",
        },
    )
