from dataclasses import dataclass

from app.core.config import Settings


@dataclass(frozen=True, slots=True)
class ReactPolicy:
    name: str
    version: str
    allowed_actions: frozenset[str]
    max_iterations: int
    max_model_calls: int
    max_tool_calls: int
    max_invalid_corrections: int
    max_identical_action_observations: int
    max_observation_chars: int
    max_total_tokens: int = 12_000


def coding_policy(settings: Settings) -> ReactPolicy:
    maximum = min(settings.sandbox_max_attempts, settings.react_max_total_model_calls)
    return ReactPolicy(
        name="coding_repair",
        version=settings.react_policy_version,
        allowed_actions=frozenset(
            {
                "list_repository",
                "read_repository_file",
                "search_repository",
                "apply_patch",
                "run_verification",
                "finish",
            }
        ),
        max_iterations=maximum,
        max_model_calls=maximum,
        # Patch actions include apply, syntax validation, and full verification.
        max_tool_calls=maximum * 3,
        max_invalid_corrections=1,
        max_identical_action_observations=2,
        max_observation_chars=settings.react_max_observation_chars,
        max_total_tokens=settings.react_max_total_tokens,
    )
