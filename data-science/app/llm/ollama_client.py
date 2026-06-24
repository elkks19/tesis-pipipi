import re
from typing import Any

import httpx


class OllamaClient:
    def __init__(self, base_url: str, model: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def check(self) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                models = response.json().get("models", [])
            available = any(model.get("name") == self.model for model in models)
            if available:
                return True, f"Modelo {self.model} disponible en Ollama."
            return False, f"Ollama responde, pero no encontre el modelo {self.model}."
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
            "messages": messages,
            "stream": False,
            "think": False,
            "options": {
                "temperature": 0.2,
            },
        }
        if tools:
            payload["tools"] = tools
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()
        message = data.get("message") or {}
        if not isinstance(message, dict):
            raise RuntimeError("Ollama devolvio un mensaje invalido.")
        return message


def strip_thinking(content: str) -> str:
    cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r".*?</think>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
    return cleaned.strip()
