from typing import Any, Protocol

from app.core.config import Settings
from app.llm.groq_client import GroqClient
from app.llm.ollama_client import OllamaClient


class ChatClient(Protocol):
    async def check(self) -> tuple[bool, str]: ...

    async def chat(self, messages: list[dict[str, Any]]) -> str: ...

    async def chat_message(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]: ...


def build_chat_client(settings: Settings) -> ChatClient:
    provider = settings.llm_provider.lower().strip()

    if provider == "groq":
        return GroqClient(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            model=settings.chat_model,
        )

    return OllamaClient(settings.ollama_url, settings.chat_model)
