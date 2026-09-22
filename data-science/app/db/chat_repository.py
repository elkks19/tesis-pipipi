from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.db.couch import CouchClient

CHAT_TYPE = "investigacion_chat"
MEMORY_SUMMARY_LIMIT = 4000
MEMORY_FACT_LIMIT = 16
MEMORY_FACT_TEXT_LIMIT = 300
RECENT_MESSAGE_LIMIT = 10


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
        limit: int = RECENT_MESSAGE_LIMIT,
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

    async def get_context_messages(
        self,
        conversation_id: str | None,
        owner_id: str,
        *,
        limit: int = RECENT_MESSAGE_LIMIT,
    ) -> list[dict[str, str]]:
        chat = await self.get_chat(conversation_id, owner_id) if conversation_id else None
        if not chat:
            return []

        messages: list[dict[str, str]] = []
        memory_message = build_memory_message(chat.get("memory"))
        if memory_message:
            messages.append(memory_message)

        messages.extend(await self.get_recent_messages(conversation_id, owner_id, limit=limit))
        return messages

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

        memory = update_chat_memory(
            chat.get("memory"),
            answer=answer,
            intent=intent,
            question=question,
            scope=scope,
        )
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
        chat["memory"] = memory
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
        elif chart_type in {"bar", "line", "pie", "scatter", "heatmap"}:
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


def build_memory_message(memory: Any) -> dict[str, str] | None:
    if not isinstance(memory, dict):
        return None

    summary = str(memory.get("summary") or "").strip()
    facts = [
        str(item).strip()
        for item in memory.get("facts") or []
        if str(item).strip()
    ][:MEMORY_FACT_LIMIT]

    if not summary and not facts:
        return None

    parts = ["Contexto de la conversacion (memoria persistente del chat):"]
    if summary:
        parts.append(f"Historial de intercambios previos:\n{summary}")
    if facts:
        parts.append("Datos clave y preferencias del usuario:")
        parts.extend(f"- {fact}" for fact in facts)

    parts.append(
        "\nUsa esta memoria como contexto conversacional para mantener coherencia. "
        "Para datos clinicos actuales, usa siempre las herramientas disponibles."
    )
    return {"role": "system", "content": "\n".join(parts)}


def update_chat_memory(
    memory: Any,
    *,
    answer: str,
    intent: str,
    question: str,
    scope: dict[str, Any],
) -> dict[str, Any]:
    current = memory if isinstance(memory, dict) else {}
    now = datetime.now(UTC).isoformat()
    previous_summary = str(current.get("summary") or "").strip()
    exchange_summary = summarize_exchange_for_memory(question, answer, intent, scope)
    summary = compact_memory_summary(previous_summary, exchange_summary)
    facts = merge_memory_facts(current.get("facts"), extract_explicit_memory_facts(question, answer))

    return {
        "facts": facts,
        "summary": summary,
        "updatedAt": now,
    }


def summarize_exchange_for_memory(
    question: str,
    answer: str,
    intent: str,
    scope: dict[str, Any],
) -> str:
    cleaned_question = " ".join(question.split())
    cleaned_answer = " ".join(answer.split())
    scope_parts = []
    role = scope.get("role")
    station_key = scope.get("stationKey") or scope.get("station_key")
    viaje_id = scope.get("viajeId") or scope.get("viaje_id")
    viaje_ids = scope.get("viajeIds") or scope.get("viaje_ids")
    if role:
        scope_parts.append(f"rol {role}")
    if station_key:
        scope_parts.append(f"estacion {station_key}")
    if viaje_id:
        scope_parts.append(f"viaje {viaje_id}")
    elif viaje_ids:
        scope_parts.append(f"viajes {', '.join(map(str, viaje_ids[:4]))}")

    scope_text = f" ({'; '.join(scope_parts)})" if scope_parts else ""
    answer_summary = cleaned_answer[:500].rstrip()
    question_summary = cleaned_question[:220].rstrip()
    return (
        f"[{intent}{scope_text}] P: {question_summary} "
        f"R: {answer_summary}"
    ).strip()


def compact_memory_summary(previous_summary: str, exchange_summary: str) -> str:
    if not previous_summary:
        return exchange_summary[:MEMORY_SUMMARY_LIMIT]

    combined = f"{previous_summary}\n{exchange_summary}".strip()
    if len(combined) <= MEMORY_SUMMARY_LIMIT:
        return combined

    lines = [line for line in combined.splitlines() if line.strip()]
    kept: list[str] = []
    total = 0
    for line in reversed(lines):
        line_len = len(line) + 1
        if total + line_len > MEMORY_SUMMARY_LIMIT:
            break
        kept.append(line)
        total += line_len

    return "\n".join(reversed(kept))


def extract_explicit_memory_facts(question: str, answer: str = "") -> list[str]:
    cleaned = " ".join(question.split())
    lowered = cleaned.lower()
    facts: list[str] = []

    # Explicit memory instructions from user
    markers = [
        "recuerda que",
        "acuérdate que",
        "acuerdate que",
        "ten en cuenta que",
        "de ahora en adelante",
        "para este chat",
        "no olvides que",
        "siempre que",
        "cada vez que",
    ]
    if any(marker in lowered for marker in markers):
        facts.append(cleaned[:MEMORY_FACT_TEXT_LIMIT].rstrip())

    # Extract key numeric findings from the answer to remember
    if answer:
        cleaned_answer = " ".join(answer.split())
        # Look for patterns like "encontre N historias", "promedio de X es Y"
        import re
        patterns = [
            r"encontr[eé]\s+(\d+\s+historias[^.]*\.)",
            r"el\s+promedio\s+de\s+[^.]+\.",
            r"la\s+distribuci[oó]n\s+[^.]+\.",
            r"los\s+diagn[oó]sticos\s+m[aá]s\s+frecuentes[^.]*\.",
        ]
        for pattern in patterns:
            match = re.search(pattern, cleaned_answer.lower())
            if match:
                start = match.start()
                # Get the original case text
                snippet = cleaned_answer[start:start + MEMORY_FACT_TEXT_LIMIT].split(".")[0] + "."
                if len(snippet) > 20:
                    facts.append(snippet.strip())
                    break  # Only keep one key finding per exchange

    return facts[:3]


def merge_memory_facts(existing: Any, new_facts: list[str]) -> list[str]:
    facts: list[str] = []
    for item in existing or []:
        text = str(item).strip()
        if text and text not in facts:
            facts.append(text[:MEMORY_FACT_TEXT_LIMIT].rstrip())

    for item in new_facts:
        text = item.strip()
        if text and text not in facts:
            facts.append(text[:MEMORY_FACT_TEXT_LIMIT].rstrip())

    return facts[-MEMORY_FACT_LIMIT:]
