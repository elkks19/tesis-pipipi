from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.db.couch import CouchClient

CHAT_TYPE = "investigacion_chat"


class ChatRepository:
    def __init__(self, couch: CouchClient) -> None:
        self.couch = couch

    async def list_chats(self, owner_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
        docs = await self.couch.find_all(
            {"ownerId": owner_id, "type": CHAT_TYPE},
            limit=limit,
            use_index="idx_investigacion_chats_owner_updated",
        )
        return sorted(docs, key=lambda doc: str(doc.get("updatedAt") or ""), reverse=True)

    async def get_chat(self, chat_id: str, owner_id: str) -> dict[str, Any] | None:
        doc = await self.couch.get(chat_id)
        if not doc or doc.get("type") != CHAT_TYPE or doc.get("ownerId") != owner_id:
            return None
        return doc

    async def get_recent_messages(
        self,
        conversation_id: str | None,
        owner_id: str,
        *,
        limit: int = 8,
    ) -> list[dict[str, str]]:
        chat = await self.get_chat(conversation_id, owner_id) if conversation_id else None
        if not chat:
            return []

        history: list[dict[str, str]] = []
        for message in list(chat.get("messages") or [])[-limit:]:
            role = str(message.get("role") or "")
            content = " ".join(str(message.get("content") or "").split())
            if role not in {"user", "assistant"} or not content:
                continue
            history.append({"role": role, "content": truncate_memory_content(content)})

        return history

    async def append_exchange(
        self,
        *,
        answer: str,
        artifacts: list[dict[str, Any]],
        conversation_id: str | None,
        intent: str,
        owner_id: str,
        question: str,
        role: str | None,
        scope: dict[str, Any],
        sources: list[dict[str, Any]],
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        chat = await self.get_chat(conversation_id, owner_id) if conversation_id else None

        if not chat:
            chat = {
                "_id": f"investigacion-chat:{uuid4()}",
                "createdAt": now,
                "messages": [],
                "ownerId": owner_id,
                "role": role,
                "summary": make_exchange_summary(question, answer),
                "title": make_title(question),
                "type": CHAT_TYPE,
            }

        messages = list(chat.get("messages") or [])
        messages.append(
            {
                "artifacts": [],
                "content": question,
                "createdAt": now,
                "role": "user",
                "sources": [],
            }
        )
        messages.append(
            {
                "artifacts": artifacts,
                "content": answer,
                "createdAt": now,
                "intent": intent,
                "role": "assistant",
                "sources": sources,
            }
        )
        assistant_message_index = len(messages) - 1

        chat["messages"] = messages
        chat["messageCount"] = len(messages)
        chat["role"] = role
        chat["scope"] = scope
        chat["summary"] = make_exchange_summary(question, answer)
        chat["title"] = chat.get("title") or make_title(question)
        chat["updatedAt"] = now

        saved = await self.couch.put(chat)
        chat["_rev"] = saved.get("rev")
        chat["_assistantMessageIndex"] = assistant_message_index
        return chat

    async def update_artifact(
        self,
        *,
        artifact_index: int,
        chart_type: str,
        chat_id: str,
        message_index: int,
        owner_id: str,
    ) -> dict[str, Any] | None:
        chat = await self.get_chat(chat_id, owner_id)
        if not chat:
            return None

        messages = list(chat.get("messages") or [])
        if message_index < 0 or message_index >= len(messages):
            return None

        message = dict(messages[message_index])
        if message.get("role") != "assistant":
            return None

        artifacts = list(message.get("artifacts") or [])
        if artifact_index < 0 or artifact_index >= len(artifacts):
            return None

        artifact = dict(artifacts[artifact_index])
        spec = dict(artifact.get("spec") or {})
        if not spec.get("x") or not spec.get("y"):
            return None

        if chart_type == "table":
            artifact["type"] = "table"
            spec["kind"] = "table"
        elif chart_type in {"bar", "line", "pie"}:
            artifact["type"] = "chart"
            spec["kind"] = chart_type
        else:
            return None

        artifact["spec"] = spec
        artifacts[artifact_index] = artifact
        message["artifacts"] = artifacts
        messages[message_index] = message
        chat["messages"] = messages
        chat["updatedAt"] = datetime.now(UTC).isoformat()

        saved = await self.couch.put(chat)
        chat["_rev"] = saved.get("rev")
        return artifact


def make_title(question: str) -> str:
    cleaned = " ".join(question.split())
    return cleaned[:72] or "Nueva consulta"


def make_exchange_summary(question: str, answer: str) -> str:
    cleaned_question = " ".join(question.split())
    cleaned_answer = " ".join(answer.split())
    summary = f"{cleaned_question} - {cleaned_answer}" if cleaned_answer else cleaned_question
    return summary[:180] or "Consulta de investigacion"


def truncate_memory_content(content: str, limit: int = 900) -> str:
    if len(content) <= limit:
        return content
    return f"{content[:limit].rstrip()}..."
