from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from app.core.errors import AppError
from app.model_providers.base import ChatRequest, ChatResult
from app.model_providers.ollama import OllamaModelProvider
from app.tasks.react_actions import ActionEnvelope, parse_action
from app.tasks.react_observations import Observation
from app.tasks.react_policies import ReactPolicy

PromptBuilder = Callable[[int, int, int, int, list[Observation]], str]
ActionHandler = Callable[[ActionEnvelope], Awaitable[tuple[Observation, str | None, int]]]
EventHandler = Callable[[str, dict[str, object]], None]
BoundaryCheck = Callable[[], None]


@dataclass(slots=True)
class ReactLoopResult:
    terminal_reason: str
    iterations: int
    model_calls: int
    tool_calls: int
    total_tokens: int
    observations: list[Observation] = field(default_factory=list)
    chats: list[ChatResult] = field(default_factory=list)


async def run_react_loop(
    provider: OllamaModelProvider,
    model_key: str,
    keep_alive: str,
    policy: ReactPolicy,
    build_prompt: PromptBuilder,
    handle_action: ActionHandler,
    record_event: EventHandler,
    check_boundary: BoundaryCheck,
) -> ReactLoopResult:
    observations: list[Observation] = []
    chats: list[ChatResult] = []
    tool_calls = 0
    total_tokens = 0
    repeated: dict[tuple[str, str], int] = {}

    for iteration in range(1, policy.max_iterations + 1):
        check_boundary()
        corrections = 0
        while True:
            if len(chats) >= policy.max_model_calls:
                raise AppError(
                    "REACT_MODEL_BUDGET_EXCEEDED", "The ReAct model-call budget was exhausted.", 409
                )
            if total_tokens >= policy.max_total_tokens:
                raise AppError(
                    "REACT_TOKEN_BUDGET_EXCEEDED", "The ReAct token budget was exhausted.", 409
                )
            prompt = build_prompt(iteration, len(chats), tool_calls, total_tokens, observations)
            chat = await provider.chat(
                ChatRequest(
                    model_key=model_key,
                    prompt=prompt,
                    keep_alive=keep_alive,
                    seed=100 + len(chats),
                    temperature=0.0 if corrections == 0 else 0.1,
                )
            )
            chats.append(chat)
            total_tokens += (
                chat.prompt_tokens if chat.prompt_tokens is not None else max(1, len(prompt) // 4)
            ) + (
                chat.completion_tokens
                if chat.completion_tokens is not None
                else max(1, len(chat.content) // 4)
            )
            if total_tokens > policy.max_total_tokens:
                raise AppError(
                    "REACT_TOKEN_BUDGET_EXCEEDED", "The ReAct token budget was exhausted.", 409
                )
            check_boundary()
            try:
                action = parse_action(chat.content, policy.allowed_actions)
            except AppError as exc:
                record_event(
                    "ACTION_REJECTED",
                    {"iteration": iteration, "error_code": exc.code, "correction": corrections + 1},
                )
                if exc.code == "ACTION_POLICY_DENIED":
                    raise
                if corrections >= policy.max_invalid_corrections:
                    raise
                corrections += 1
                observations.append(
                    Observation(
                        tool="action_validator",
                        status="rejected",
                        summary=f"{exc.message} Use the exact JSON schema and allowed actions.",
                        facts={"error_code": exc.code},
                    )
                )
                continue
            break

        record_event(
            "ACTION_PROPOSED",
            {
                "iteration": iteration,
                "action": action.action,
                "action_signature": action.signature(),
                "reason_summary": action.reason_summary,
                "expected_evidence": action.expected_evidence,
                "confidence": action.confidence,
            },
        )
        if tool_calls >= policy.max_tool_calls:
            raise AppError(
                "REACT_TOOL_BUDGET_EXCEEDED", "The ReAct tool-call budget was exhausted.", 409
            )
        record_event("ACTION_AUTHORIZED", {"iteration": iteration, "action": action.action})
        observation, terminal, action_tool_calls = await handle_action(action)
        if action_tool_calls < 0 or tool_calls + action_tool_calls > policy.max_tool_calls:
            raise AppError(
                "REACT_TOOL_BUDGET_EXCEEDED", "The ReAct tool-call budget was exhausted.", 409
            )
        tool_calls += action_tool_calls
        observations.append(observation)
        record_event(
            "TOOL_OBSERVATION_RECORDED",
            {
                "iteration": iteration,
                "action": action.action,
                "action_id": observation.action_id,
                "status": observation.status,
                "summary": observation.summary,
                "truncated": observation.truncated,
                "duration_ms": observation.duration_ms,
            },
        )
        pair = (action.signature(), observation.signature())
        repeated[pair] = repeated.get(pair, 0) + 1
        if repeated[pair] >= policy.max_identical_action_observations:
            raise AppError(
                "REACT_REPETITION_DETECTED",
                "The same action produced the same observation repeatedly.",
                409,
            )
        record_event(
            "LOOP_CHECKPOINTED",
            {
                "iteration": iteration,
                "model_calls": len(chats),
                "tool_calls": tool_calls,
                "total_tokens": total_tokens,
                "terminal_reason": terminal,
            },
        )
        check_boundary()
        if terminal:
            return ReactLoopResult(
                terminal,
                iteration,
                len(chats),
                tool_calls,
                total_tokens,
                observations,
                chats,
            )

    raise AppError(
        "REACT_ITERATION_BUDGET_EXCEEDED", "The ReAct iteration budget was exhausted.", 409
    )
