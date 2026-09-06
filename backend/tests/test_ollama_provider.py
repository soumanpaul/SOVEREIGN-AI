import httpx
import pytest

from app.core.errors import AppError
from app.model_providers.base import ChatRequest
from app.model_providers.ollama import OllamaModelProvider


@pytest.mark.asyncio
async def test_chat_maps_local_ollama_response(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_post(*_: object, **__: object) -> httpx.Response:
        request = httpx.Request("POST", "http://ollama/api/chat")
        return httpx.Response(200, request=request, json={"message": {"content": "Local reply"}})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    provider = OllamaModelProvider("http://ollama")

    result = await provider.chat(ChatRequest("tiny-model", "Hello", "2m"))

    assert result.content == "Local reply"
    assert result.duration_ms >= 0


@pytest.mark.asyncio
async def test_chat_returns_safe_error_when_ollama_is_unreachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_post(*_: object, **__: object) -> httpx.Response:
        request = httpx.Request("POST", "http://ollama/api/chat")
        raise httpx.ConnectError("secret host detail", request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fail_post)
    provider = OllamaModelProvider("http://ollama")

    with pytest.raises(AppError) as captured:
        await provider.chat(ChatRequest("tiny-model", "Hello", "2m"))

    assert captured.value.code == "OLLAMA_UNAVAILABLE"
    assert "secret host detail" not in captured.value.message

