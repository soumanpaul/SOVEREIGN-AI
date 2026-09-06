from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class HealthStatus(BaseModel):
    status: Literal["ok", "degraded", "unavailable"]
    service: str
    details: dict[str, Any] = Field(default_factory=dict)


class ModelHealth(BaseModel):
    status: Literal["ready", "unavailable", "unknown"]
    observed_at: datetime
    latency_ms: int | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class ModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    provider: str
    model_key: str
    capabilities: list[str]
    context_window: int | None
    quantization: str | None
    priority: int
    enabled: bool
    latest_health: ModelHealth | None = None


class InferenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=1, max_length=8_000)
    model_id: UUID | None = None


class InferenceResponse(BaseModel):
    model_id: UUID
    model_name: str
    provider: Literal["ollama"]
    content: str
    duration_ms: int
    local: Literal[True] = True

