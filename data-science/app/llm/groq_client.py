from collections.abc import AsyncIterator
import logging
from time import perf_counter
from typing import Any

import httpx

from app.llm.ollama_client import strip_thinking

logger = logging.getLogger(__name__)


def raise_for_groq_error(response: httpx.Response) -> None:
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        try:
            detail = response.json()
        except ValueError:
            detail = response.text
        if response.status_code == 429:
            retry_after = response.headers.get("retry-after")
            suffix = f" Reintenta en {retry_after}s." if retry_after else ""
            raise RuntimeError(
                "Groq alcanzo el limite del plan actual. "
                "Reduce el alcance, espera a que se libere cuota o usa un modelo mas ligero."
                f"{suffix}"
            ) from exc
        raise RuntimeError(f"Groq HTTP {response.status_code}: {detail}") from exc


class GroqClient:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        *,
        max_completion_tokens: int,
        reasoning_effort: str,
        reasoning_format: str,
        temperature: float,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.max_completion_tokens = max_completion_tokens
        self.model = model
        self.reasoning_effort = reasoning_effort.strip()
        self.reasoning_format = reasoning_format.strip()
        self.temperature = temperature

    async def check(self) -> tuple[bool, str]:
        if not self.api_key:
            return False, "Falta GROQ_API_KEY para usar Groq."

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=self._headers(),
                )
                response.raise_for_status()
                models = response.json().get("data", [])
            available = any(model.get("id") == self.model for model in models)
            if available:
                return True, f"Modelo {self.model} disponible en Groq."
            return False, f"Groq responde, pero no encontre el modelo {self.model}."
        except Exception as exc:
            return False, str(exc)

    async def chat(self, messages: list[dict[str, Any]]) -> str:
        message = await self.chat_message(messages)
        return strip_thinking(str(message.get("content") or "").strip())

    async def chat_message(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": self._normalize_messages(messages),
            "max_completion_tokens": self.max_completion_tokens,
            "temperature": self.temperature,
        }
        self._add_reasoning_options(payload)
        if tools:
            payload["tools"] = tools
        started_at = perf_counter()
        logger.info(
            "Groq chat request started model=%s messages=%s tools=%s",
            self.model,
            len(payload["messages"]),
            bool(tools),
        )
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            raise_for_groq_error(response)
            data = response.json()
        logger.info(
            "Groq chat request finished model=%s status=%s request_id=%s elapsed_ms=%d",
            self.model,
            response.status_code,
            response.headers.get("x-request-id") or response.headers.get("x-groq-id") or "-",
            int((perf_counter() - started_at) * 1000),
        )
        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError("Groq no devolvio opciones de respuesta.")
        message = choices[0].get("message") or {}
        if not isinstance(message, dict):
            raise RuntimeError("Groq devolvio un mensaje invalido.")
        return message

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
    ) -> AsyncIterator[str]:
        """Stream the final text response token by token."""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": self._normalize_messages(messages),
            "max_completion_tokens": self.max_completion_tokens,
            "temperature": self.temperature,
            "stream": True,
        }
        self._add_reasoning_options(payload)
        started_at = perf_counter()
        logger.info(
            "Groq stream request started model=%s messages=%s",
            self.model,
            len(payload["messages"]),
        )
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            ) as response:
                raise_for_groq_error(response)
                request_id = response.headers.get("x-request-id") or response.headers.get("x-groq-id") or "-"
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    import json as _json
                    try:
                        chunk = _json.loads(data_str)
                    except ValueError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield content
        logger.info(
            "Groq stream request finished model=%s request_id=%s elapsed_ms=%d",
            self.model,
            request_id,
            int((perf_counter() - started_at) * 1000),
        )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _add_reasoning_options(self, payload: dict[str, Any]) -> None:
        if self.reasoning_format:
            payload["reasoning_format"] = self.reasoning_format
        if self.reasoning_effort:
            payload["reasoning_effort"] = self.reasoning_effort

    @staticmethod
    def _normalize_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for message in messages:
            role = message.get("role")
            if role == "tool":
                tool_call_id = message.get("tool_call_id")
                if not tool_call_id:
                    # Groq requires tool_call_id — generate a fallback
                    tool_name = message.get("tool_name") or "unknown"
                    tool_call_id = f"call_{tool_name}_{len(normalized)}"
                normalized.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "content": str(message.get("content") or ""),
                    }
                )
                continue

            normalized_message = {
                key: value
                for key, value in message.items()
                if key in {"content", "role", "tool_calls"} and value is not None
            }
            normalized.append(normalized_message)

        return normalized
