from typing import Any

from pydantic import BaseModel, Field


class Source(BaseModel):
    chunk_id: str
    document_id: str
    document_type: str
    title: str
    score: float
    metadata: dict[str, Any]


class Artifact(BaseModel):
    type: str
    title: str
    data: Any
    spec: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    answer: str
    assistant_message_index: int | None = None
    conversation_id: str | None = None
    intent: str
    artifacts: list[Artifact]
    sources: list[Source]


class ChatMessageResponse(BaseModel):
    artifacts: list[Artifact] = Field(default_factory=list)
    content: str
    createdAt: str
    messageIndex: int
    intent: str | None = None
    role: str
    sources: list[Source] = Field(default_factory=list)


class ChatSummaryResponse(BaseModel):
    id: str
    messageCount: int = 0
    summary: str
    title: str
    updatedAt: str | None = None


class ChatDetailResponse(ChatSummaryResponse):
    messages: list[ChatMessageResponse]
    scope: dict[str, Any] | None = None


class IndexResponse(BaseModel):
    ok: bool
    indexed_chunks: int
    historias: int
    pacientes: int
    viajes: int
    detail: str


class HealthResponse(BaseModel):
    ok: bool
    couchdb: dict[str, Any]
    indexes: dict[str, Any]
    ollama: dict[str, Any]
    storage_dir: str
    chat_model: str
    embedding_model: str


class ModelStatusResponse(BaseModel):
    ok: bool
    provider: str
    chat_model: str
    embedding_model: str
    detail: str
