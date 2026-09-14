import hashlib
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from app.core.config import Settings
from app.core.errors import AppError
from app.model_providers.ollama import OllamaModelProvider
from app.services.code_repository import (
    extract_unified_diff,
    repository_catalog,
    restore_repository_files,
    snapshot_repository,
)
from app.tasks.completion_validators import validate_coding_completion
from app.tasks.react_actions import ActionEnvelope
from app.tasks.react_context import coding_action_prompt
from app.tasks.react_loop import ReactLoopResult, run_react_loop
from app.tasks.react_observations import Observation, sanitize_observation
from app.tasks.react_policies import coding_policy
from app.tools.registry import ToolContext, ToolRegistry, ToolResult

EventRecorder = Callable[[str, dict[str, object]], None]
ObservationRecorder = Callable[[int, ActionEnvelope, Observation], None]
BoundaryCheck = Callable[[], None]


@dataclass(slots=True)
class CodingReactResult:
    loop: ReactLoopResult
    final_test: ToolResult
    attempts: list[dict[str, object]] = field(default_factory=list)
    changed_files: set[str] = field(default_factory=set)


async def execute_coding_react_loop(
    *,
    goal: str,
    original: dict[str, str],
    baseline: ToolResult,
    verification_command: str,
    context: ToolContext,
    registry: ToolRegistry,
    provider: OllamaModelProvider,
    model_key: str,
    settings: Settings,
    record_event: EventRecorder,
    record_observation: ObservationRecorder,
    check_boundary: BoundaryCheck,
) -> CodingReactResult:
    repository_root = context.repository_root
    if repository_root is None:
        raise AppError("REPOSITORY_CONTEXT_MISSING", "No coding repository is available.", 409)
    policy = coding_policy(settings)
    catalog = repository_catalog(repository_root)
    final_test = baseline
    attempts: list[dict[str, object]] = []
    all_changed: set[str] = set()
    current_iteration = 0
    baseline_observation = sanitize_observation(
        "baseline_verification",
        baseline.status,
        baseline.summary,
        baseline.data,
        baseline.duration_ms,
        policy.max_observation_chars,
        sensitive_values=(str(repository_root),),
    )

    def build_prompt(
        iteration: int,
        model_calls: int,
        tool_calls: int,
        total_tokens: int,
        observations: list[Observation],
    ) -> str:
        nonlocal current_iteration
        current_iteration = iteration
        return coding_action_prompt(
            goal,
            catalog,
            [baseline_observation, *observations],
            policy,
            iteration,
            model_calls,
            tool_calls,
            total_tokens,
        )

    async def execute_tool(name: str, arguments: dict[str, Any]) -> ToolResult:
        check_boundary()
        result = await registry.execute("coding_agent", name, arguments, context)
        check_boundary()
        return result

    def observation(tool: str, result: ToolResult) -> Observation:
        return sanitize_observation(
            tool,
            result.status,
            result.summary,
            result.data,
            result.duration_ms,
            policy.max_observation_chars,
            sensitive_values=(str(repository_root),),
        )

    async def handle(action: ActionEnvelope) -> tuple[Observation, str | None, int]:
        nonlocal final_test
        if action.action == "list_repository":
            result = await execute_tool("list_repository", {})
            item = observation(action.action, result)
            record_observation(current_iteration, action, item)
            return item, None, 1
        if action.action == "read_repository_file":
            arguments = dict(action.arguments)
            arguments["max_chars"] = min(
                int(arguments["max_chars"]), settings.react_repository_file_chars
            )
            result = await execute_tool("read_repository_file", arguments)
            item = observation(action.action, result)
            record_observation(current_iteration, action, item)
            return item, None, 1
        if action.action == "search_repository":
            result = await execute_tool("search_repository", action.arguments)
            item = observation(action.action, result)
            record_observation(current_iteration, action, item)
            return item, None, 1
        if action.action == "run_verification":
            command = "compile" if action.arguments["scope"] == "syntax" else verification_command
            result = await execute_tool("run_python_tests", {"command": command})
            if command == verification_command:
                final_test = result
            item = observation(action.action, result)
            current = snapshot_repository(repository_root, settings.sandbox_max_repository_bytes)
            valid = validate_coding_completion(original, current, final_test.status == "completed")
            terminal = "completion_validated" if valid.valid else None
            record_observation(current_iteration, action, item)
            return item, terminal, 1
        if action.action == "finish":
            current = snapshot_repository(repository_root, settings.sandbox_max_repository_bytes)
            valid = validate_coding_completion(original, current, final_test.status == "completed")
            item = Observation(
                tool="completion_validator",
                status="completed" if valid.valid else "failed",
                summary=valid.summary,
                facts={
                    "diff_non_empty": current != original,
                    "verification_passed": final_test.status == "completed",
                },
            )
            if not valid.valid:
                record_event(
                    "COMPLETION_VALIDATION_FAILED",
                    {"iteration": current_iteration, "summary": valid.summary},
                )
            record_observation(current_iteration, action, item)
            return item, "completion_validated" if valid.valid else None, 0
        if action.action == "request_human_review":
            item = Observation(
                tool="human_review",
                status="waiting",
                summary=str(action.arguments["question"]),
                facts={"question": action.arguments["question"]},
            )
            record_event(
                "HUMAN_REVIEW_REQUESTED",
                {"iteration": current_iteration, "question": action.arguments["question"]},
            )
            record_observation(current_iteration, action, item)
            return item, "human_review_requested", 0
        if action.action != "apply_patch":
            raise AppError("ACTION_NOT_REGISTERED", "The coding action is not implemented.", 422)

        before = snapshot_repository(repository_root, settings.sandbox_max_repository_bytes)
        try:
            patch = extract_unified_diff(
                str(action.arguments["patch"]), settings.sandbox_max_patch_chars
            )
            applied = await execute_tool("apply_patch", {"patch": patch})
        except AppError as exc:
            if not exc.code.startswith("PATCH_"):
                raise
            item = Observation(
                tool="apply_patch",
                status="rejected",
                summary=f"The deterministic patch validator rejected the proposal: {exc.message}",
                facts={"error_code": exc.code},
            )
            record_event(
                "ACTION_REJECTED",
                {
                    "iteration": current_iteration,
                    "action": action.action,
                    "error_code": exc.code,
                },
            )
            record_observation(current_iteration, action, item)
            return item, None, 1
        changed = [str(path) for path in applied.data["changed_files"]]
        all_changed.update(changed)
        tool_count = 1

        syntax = None
        if verification_command != "compile":
            syntax = await execute_tool("run_python_tests", {"command": "compile"})
            tool_count += 1
            if syntax.status != "completed":
                restore_repository_files(repository_root, before, changed)
                item = sanitize_observation(
                    action.action,
                    "failed",
                    "The patch introduced a syntax error and was rolled back "
                    "to the last valid snapshot.",
                    {"changed_files": changed, "syntax": syntax.data, "rolled_back": True},
                    applied.duration_ms + syntax.duration_ms,
                    policy.max_observation_chars,
                    sensitive_values=(str(repository_root),),
                )
                attempts.append(
                    {
                        "iteration": current_iteration,
                        "changed_files": changed,
                        "syntax": syntax.data,
                        "rolled_back": True,
                    }
                )
                record_observation(current_iteration, action, item)
                return item, None, tool_count

        final_test = await execute_tool("run_python_tests", {"command": verification_command})
        tool_count += 1
        attempts.append(
            {
                "iteration": current_iteration,
                "patch_sha256": hashlib.sha256(patch.encode()).hexdigest(),
                "changed_files": changed,
                "test": final_test.data,
            }
        )
        current = snapshot_repository(repository_root, settings.sandbox_max_repository_bytes)
        valid = validate_coding_completion(original, current, final_test.status == "completed")
        combined = ToolResult(
            "completed" if valid.valid else "failed",
            valid.summary if valid.valid else final_test.summary,
            {
                "changed_files": changed,
                "verification": final_test.data,
                "syntax_passed": syntax is None or syntax.status == "completed",
            },
            applied.duration_ms + (syntax.duration_ms if syntax else 0) + final_test.duration_ms,
        )
        item = observation(action.action, combined)
        record_observation(current_iteration, action, item)
        return item, "completion_validated" if valid.valid else None, tool_count

    loop = await run_react_loop(
        provider,
        model_key,
        settings.model_keep_alive,
        policy,
        build_prompt,
        handle,
        record_event,
        check_boundary,
    )
    if loop.terminal_reason == "human_review_requested":
        raise AppError(
            "HUMAN_REVIEW_REQUIRED",
            "The coding task requires human clarification before it can continue.",
            409,
        )
    return CodingReactResult(loop, final_test, attempts, all_changed)
