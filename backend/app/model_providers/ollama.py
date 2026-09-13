import time
from typing import Any

import httpx

from app.core.errors import AppError
from app.model_providers.base import ChatRequest, ChatResult, EmbeddingResult, ProviderHealth


class OllamaModelProvider:
    def __init__(self, base_url: str, timeout_seconds: float = 120.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = httpx.Timeout(timeout_seconds, connect=5.0)

    async def _installed_models(self) -> tuple[list[str], int]:
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(f"{self._base_url}/api/tags")
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise AppError(
                code="OLLAMA_UNAVAILABLE",
                message="The local Ollama service is unavailable.",
                status_code=503,
                retryable=True,
            ) from exc
        elapsed = int((time.perf_counter() - started) * 1000)
        payload = response.json()
        names = [str(item.get("name")) for item in payload.get("models", []) if item.get("name")]
        return names, elapsed

    async def health(self, model_key: str) -> ProviderHealth:
        names, elapsed = await self._installed_models()
        ready = model_key in names or any(name.split(":", 1)[0] == model_key for name in names)
        return ProviderHealth(
            ready=ready,
            latency_ms=elapsed,
            details={"installed": ready, "provider_reachable": True},
        )

    async def chat(self, request: ChatRequest) -> ChatResult:
        payload: dict[str, Any] = {
            "model": request.model_key,
            "stream": False,
            "keep_alive": request.keep_alive,
            "messages": [{"role": "user", "content": request.prompt}],
            "options": {"temperature": request.temperature, "seed": request.seed},
        }
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(f"{self._base_url}/api/chat", json=payload)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            code = (
                "MODEL_NOT_INSTALLED"
                if exc.response.status_code == 404
                else "OLLAMA_REQUEST_FAILED"
            )
            raise AppError(
                code=code,
                message="The configured local model could not process the request.",
                status_code=503,
                retryable=exc.response.status_code >= 500,
            ) from exc
        except httpx.HTTPError as exc:
            raise AppError(
                code="OLLAMA_UNAVAILABLE",
                message="The local Ollama service is unavailable.",
                status_code=503,
                retryable=True,
            ) from exc

        elapsed = int((time.perf_counter() - started) * 1000)
        content = str(response.json().get("message", {}).get("content", "")).strip()
        if not content:
            raise AppError(
                code="MODEL_EMPTY_RESPONSE",
                message="The local model returned an empty response.",
                status_code=502,
                retryable=True,
            )
        return ChatResult(content=content, duration_ms=elapsed)

    async def embed(self, texts: list[str], model_key: str) -> EmbeddingResult:
        if not texts:
            return EmbeddingResult(vectors=[], duration_ms=0)
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    f"{self._base_url}/api/embed",
                    json={"model": model_key, "input": texts, "truncate": True, "keep_alive": "2m"},
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise AppError(
                code="EMBEDDING_FAILED",
                message="The local embedding model could not process the text.",
                status_code=503,
                retryable=True,
            ) from exc
        vectors = response.json().get("embeddings", [])
        if len(vectors) != len(texts):
            raise AppError(
                code="EMBEDDING_COUNT_MISMATCH",
                message="Embedding output was incomplete.",
                status_code=502,
            )
        return EmbeddingResult(
            vectors=vectors, duration_ms=int((time.perf_counter() - started) * 1000)
        )
