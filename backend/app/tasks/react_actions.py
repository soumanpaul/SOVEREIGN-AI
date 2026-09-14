import hashlib
import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.errors import AppError


class StrictArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ListRepositoryArguments(StrictArguments):
    pass


class ReadRepositoryFileArguments(StrictArguments):
    path: str = Field(min_length=1, max_length=240)
    max_chars: int = Field(default=12_000, ge=500, le=50_000)


class SearchRepositoryArguments(StrictArguments):
    query: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=20, ge=1, le=50)


class ApplyPatchArguments(StrictArguments):
    patch: str = Field(min_length=10, max_length=500_000)


class RunVerificationArguments(StrictArguments):
    scope: Literal["syntax", "full"] = "full"


class FinishArguments(StrictArguments):
    pass


class RequestHumanReviewArguments(StrictArguments):
    question: str = Field(min_length=5, max_length=500)


ACTION_ARGUMENTS: dict[str, type[StrictArguments]] = {
    "list_repository": ListRepositoryArguments,
    "read_repository_file": ReadRepositoryFileArguments,
    "search_repository": SearchRepositoryArguments,
    "apply_patch": ApplyPatchArguments,
    "run_verification": RunVerificationArguments,
    "finish": FinishArguments,
    "request_human_review": RequestHumanReviewArguments,
}


class ActionEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(min_length=1, max_length=80)
    arguments: dict[str, Any]
    reason_summary: str = Field(min_length=1, max_length=500)
    expected_evidence: str = Field(min_length=1, max_length=500)
    confidence: float = Field(ge=0, le=1)

    def signature(self) -> str:
        canonical = json.dumps(
            {"action": self.action, "arguments": self.arguments},
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical.encode()).hexdigest()


def parse_action(raw: str, allowed_actions: frozenset[str]) -> ActionEnvelope:
    if len(raw) > 550_000:
        raise AppError("ACTION_SIZE_LIMIT", "The proposed action is too large.", 422)
    candidate = raw.strip()
    if candidate.startswith("```"):
        lines = candidate.splitlines()
        if len(lines) >= 3 and lines[-1].strip() == "```":
            candidate = "\n".join(lines[1:-1]).strip()
    try:
        decoded = json.loads(candidate)
        envelope = ActionEnvelope.model_validate(decoded)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise AppError(
            "ACTION_SCHEMA_INVALID", "Return one valid JSON action envelope.", 422
        ) from exc
    if envelope.action not in allowed_actions:
        raise AppError(
            "ACTION_POLICY_DENIED", "The proposed action is not allowed by this workflow.", 403
        )
    argument_model = ACTION_ARGUMENTS.get(envelope.action)
    if argument_model is None:
        raise AppError("ACTION_NOT_REGISTERED", "The proposed action is not registered.", 422)
    try:
        validated = argument_model.model_validate(envelope.arguments)
    except ValidationError as exc:
        raise AppError(
            "ACTION_ARGUMENTS_INVALID", "The action arguments failed strict validation.", 422
        ) from exc
    return envelope.model_copy(update={"arguments": validated.model_dump()})
