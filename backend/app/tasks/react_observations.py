import json
import re
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

SECRET_PATTERNS = (
    re.compile(r"(?i)(authorization|api[_-]?key|password|secret|token)\s*[:=]\s*[^\s,;]+"),
    re.compile(r"(?i)bearer\s+[a-z0-9._~+/=-]+"),
)


@dataclass(frozen=True, slots=True)
class Observation:
    tool: str
    status: str
    summary: str
    facts: dict[str, Any] = field(default_factory=dict)
    evidence_refs: list[str] = field(default_factory=list)
    truncated: bool = False
    duration_ms: int = 0
    action_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def model_dump(self) -> dict[str, Any]:
        return asdict(self)

    def signature(self) -> str:
        stable = {
            "tool": self.tool,
            "status": self.status,
            "summary": self.summary,
            "facts": self.facts,
        }
        return json.dumps(stable, sort_keys=True, default=str, separators=(",", ":"))


def _redact_text(value: str, sensitive_values: tuple[str, ...]) -> str:
    result = value
    for sensitive in sensitive_values:
        if sensitive:
            result = result.replace(sensitive, "[REDACTED_PATH]")
    for pattern in SECRET_PATTERNS:
        result = pattern.sub(
            lambda match: match.group(1) + "=[REDACTED]" if match.lastindex else "[REDACTED]",
            result,
        )
    return result.replace("\x00", "")


def sanitize_observation(
    tool: str,
    status: str,
    summary: str,
    facts: dict[str, Any],
    duration_ms: int,
    max_chars: int,
    *,
    sensitive_values: tuple[str, ...] = (),
) -> Observation:
    cleaned_summary = _redact_text(summary, sensitive_values)[:500]
    serialized = _redact_text(json.dumps(facts, default=str, ensure_ascii=False), sensitive_values)
    truncated = len(serialized) > max_chars
    bounded = serialized[:max_chars]
    if truncated:
        # Preserve valid JSON and an explicit bound when truncating arbitrary tool data.
        cleaned_facts: dict[str, Any] = {
            "bounded_output": bounded,
            "original_chars": len(serialized),
        }
    else:
        loaded = json.loads(bounded)
        cleaned_facts = loaded if isinstance(loaded, dict) else {"value": loaded}
    return Observation(
        tool=tool,
        status=status,
        summary=cleaned_summary,
        facts=cleaned_facts,
        truncated=truncated,
        duration_ms=duration_ms,
    )
