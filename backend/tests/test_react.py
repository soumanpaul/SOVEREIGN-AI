import json
import uuid
from pathlib import Path
from typing import cast

import pytest
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import Workspace
from app.model_providers.base import ChatRequest, ChatResult
from app.model_providers.ollama import OllamaModelProvider
from app.tasks.coding_react import execute_coding_react_loop
from app.tasks.completion_validators import validate_coding_completion
from app.tasks.react_actions import parse_action
from app.tasks.react_loop import run_react_loop
from app.tasks.react_observations import Observation, sanitize_observation
from app.tasks.react_policies import ReactPolicy
from app.tools.registry import ToolContext, ToolRegistry, ToolResult


def action_json(action: str, arguments: dict[str, object]) -> str:
    return json.dumps(
        {
            "action": action,
            "arguments": arguments,
            "reason_summary": "Inspect the smallest relevant surface.",
            "expected_evidence": "A bounded observation.",
            "confidence": 0.8,
        }
    )


def test_action_contract_rejects_unknown_fields_and_actions() -> None:
    with pytest.raises(AppError) as invalid:
        parse_action(
            action_json("read_repository_file", {"path": "app.py", "unexpected": True}),
            frozenset({"read_repository_file"}),
        )
    assert invalid.value.code == "ACTION_ARGUMENTS_INVALID"

    with pytest.raises(AppError) as denied:
        parse_action(action_json("open_url", {}), frozenset({"finish"}))
    assert denied.value.code == "ACTION_POLICY_DENIED"


@pytest.mark.parametrize("path", ["../secret.env", "/etc/passwd", "C:\\secret.py", "bad\n.py"])
def test_action_contract_rejects_unsafe_paths_at_tool_boundary(tmp_path, path: str) -> None:
    from app.services.code_repository import read_repository_file

    with pytest.raises(AppError) as denied:
        read_repository_file(tmp_path, path, 1_000)
    assert denied.value.code == "REPOSITORY_PATH_DENIED"


def test_observation_redacts_secrets_paths_and_marks_truncation() -> None:
    observed = sanitize_observation(
        "run_verification",
        "failed",
        "token=abc123 in /private/run/repository",
        {"stderr": "password=hunter2 " + "x" * 2_000},
        12,
        120,
        sensitive_values=("/private/run/repository",),
    )
    serialized = json.dumps(observed.model_dump())
    assert "abc123" not in serialized
    assert "hunter2" not in serialized
    assert "/private/run/repository" not in serialized
    assert observed.truncated is True


def test_coding_completion_is_deterministic() -> None:
    original = {"app.py": "value = 1\n"}
    changed = {"app.py": "value = 2\n"}
    assert validate_coding_completion(original, changed, True).valid is True
    assert validate_coding_completion(original, changed, False).valid is False
    assert validate_coding_completion(original, original, True).valid is False


class FakeProvider:
    def __init__(self, responses: list[str]) -> None:
        self.responses = responses

    async def chat(self, request: ChatRequest) -> ChatResult:
        return ChatResult(self.responses.pop(0), 1, prompt_tokens=5, completion_tokens=3)


class FakeCodingRegistry:
    async def execute(self, _profile, name, arguments, context):
        from app.services.code_repository import apply_unified_diff

        if name == "apply_patch":
            changed = apply_unified_diff(context.repository_root, arguments["patch"])
            return ToolResult("completed", "Patch applied.", {"changed_files": changed}, 1)
        if name == "run_python_tests":
            return ToolResult(
                "completed",
                "Verification passed.",
                {"passed": True, "exit_code": 0, "stdout": "", "stderr": ""},
                1,
            )
        raise AssertionError(f"unexpected tool: {name}")


@pytest.mark.asyncio
async def test_coding_react_patch_is_verified_and_completed_by_application(
    tmp_path: Path,
) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    (root / "app.py").write_text("value = 1\n", encoding="utf-8")
    original = {"app.py": "value = 1\n"}
    patch = '<edit path="app.py" start="1" end="1">\nvalue = 2\n</edit>\n'
    provider = FakeProvider([action_json("apply_patch", {"patch": patch})])
    workspace = Workspace(id=uuid.uuid4(), name="ReAct")
    settings = Settings(
        data_root=tmp_path,
        react_max_total_model_calls=2,
        sandbox_max_attempts=2,
    )
    context = ToolContext(
        workspace.id,
        cast(Session, object()),
        settings,
        cast(OllamaModelProvider, provider),
        repository_root=root,
    )

    result = await execute_coding_react_loop(
        goal="Change the value to two.",
        original=original,
        baseline=ToolResult("failed", "Baseline failed.", {"passed": False, "exit_code": 1}, 1),
        verification_command="compile",
        context=context,
        registry=cast(ToolRegistry, FakeCodingRegistry()),
        provider=cast(OllamaModelProvider, provider),
        model_key="coder",
        settings=settings,
        record_event=lambda *_args: None,
        record_observation=lambda *_args: None,
        check_boundary=lambda: None,
    )

    assert result.loop.terminal_reason == "completion_validated"
    assert result.final_test.status == "completed"
    assert result.changed_files == {"app.py"}
    assert (root / "app.py").read_text(encoding="utf-8") == "value = 2\n"


@pytest.mark.asyncio
async def test_loop_terminates_immediately_on_unauthorized_action() -> None:
    provider = FakeProvider([action_json("open_url", {})])
    policy = ReactPolicy(
        "test",
        "v1",
        frozenset({"finish"}),
        max_iterations=2,
        max_model_calls=2,
        max_tool_calls=2,
        max_invalid_corrections=1,
        max_identical_action_observations=2,
        max_observation_chars=1_000,
    )

    async def handle(_action):
        raise AssertionError("unauthorized action must never reach a tool")

    with pytest.raises(AppError) as denied:
        await run_react_loop(
            cast(OllamaModelProvider, provider),
            "test-model",
            "0",
            policy,
            lambda *_args: "prompt",
            handle,
            lambda *_args: None,
            lambda: None,
        )
    assert denied.value.code == "ACTION_POLICY_DENIED"


@pytest.mark.asyncio
async def test_loop_allows_one_schema_correction_and_stops_deterministically() -> None:
    provider = FakeProvider(["not json", action_json("finish", {})])
    events: list[str] = []
    policy = ReactPolicy(
        "test",
        "v1",
        frozenset({"finish"}),
        max_iterations=1,
        max_model_calls=2,
        max_tool_calls=1,
        max_invalid_corrections=1,
        max_identical_action_observations=2,
        max_observation_chars=1_000,
    )

    async def handle(_action):
        return Observation("completion_validator", "completed", "Validated."), "done", 0

    result = await run_react_loop(
        cast(OllamaModelProvider, provider),
        "test-model",
        "0",
        policy,
        lambda *_args: "prompt",
        handle,
        lambda event, _payload: events.append(event),
        lambda: None,
    )
    assert result.terminal_reason == "done"
    assert result.model_calls == 2
    assert "ACTION_REJECTED" in events
    assert events[-1] == "LOOP_CHECKPOINTED"


@pytest.mark.asyncio
async def test_loop_detects_repeated_action_and_observation() -> None:
    response = action_json("finish", {})
    provider = FakeProvider([response, response])
    policy = ReactPolicy(
        "test",
        "v1",
        frozenset({"finish"}),
        max_iterations=2,
        max_model_calls=2,
        max_tool_calls=2,
        max_invalid_corrections=0,
        max_identical_action_observations=2,
        max_observation_chars=1_000,
    )

    async def handle(_action):
        return Observation("completion_validator", "failed", "Not ready."), None, 0

    with pytest.raises(AppError) as repeated:
        await run_react_loop(
            cast(OllamaModelProvider, provider),
            "test-model",
            "0",
            policy,
            lambda *_args: "prompt",
            handle,
            lambda *_args: None,
            lambda: None,
        )
    assert repeated.value.code == "REACT_REPETITION_DETECTED"


@pytest.mark.asyncio
async def test_loop_stops_before_executing_action_over_token_budget() -> None:
    provider = FakeProvider([action_json("finish", {})])
    policy = ReactPolicy(
        "test",
        "v1",
        frozenset({"finish"}),
        max_iterations=1,
        max_model_calls=1,
        max_tool_calls=1,
        max_invalid_corrections=0,
        max_identical_action_observations=2,
        max_observation_chars=1_000,
        max_total_tokens=7,
    )

    async def handle(_action):
        raise AssertionError("over-budget action must not execute")

    with pytest.raises(AppError) as exhausted:
        await run_react_loop(
            cast(OllamaModelProvider, provider),
            "test-model",
            "0",
            policy,
            lambda *_args: "prompt",
            handle,
            lambda *_args: None,
            lambda: None,
        )
    assert exhausted.value.code == "REACT_TOKEN_BUDGET_EXCEEDED"
