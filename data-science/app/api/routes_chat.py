from fastapi import APIRouter, Depends

from app.analytics.dataframe_builder import build_story_rows
from app.analytics.intent import detect_intent
from app.analytics.stats import answer_with_statistics
from app.core.config import Settings, get_settings
from app.core.security import require_internal_token
from app.db.chat_repository import ChatRepository
from app.db.couch import CouchClient
from app.db.repositories import TesisRepository
from app.llm.ollama_client import OllamaClient
from app.llm.prompts import build_rag_messages
from app.models.requests import ChatRequest
from app.models.responses import ChatResponse
from app.rag.embeddings import EmbeddingService
from app.rag.retrieval import RagRetriever
from app.rag.vector_store import SQLiteVectorStore

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    intent = detect_intent(request.message)
    filters = request.scope.to_filters()

    couch = CouchClient(settings.couchdb_url)
    repository = TesisRepository(couch)
    chat_repository = ChatRepository(couch)

    if intent in {"chart", "statistic"}:
        historias = await repository.fetch_historias(**filters)
        pacientes = await repository.fetch_pacientes_for_historias(historias)
        rows = build_story_rows(historias, pacientes)
        analytics_response = answer_with_statistics(
            request.message,
            rows,
            intent,
            request.chart_type,
        )
        saved_chat = await chat_repository.append_exchange(
            answer=analytics_response.answer,
            artifacts=[artifact.model_dump() for artifact in analytics_response.artifacts],
            conversation_id=request.conversation_id,
            intent=intent,
            owner_id=request.scope.user_id or "anonymous",
            question=request.message,
            role=request.scope.role,
            scope=request.scope.model_dump(by_alias=True),
            sources=[],
        )
        return ChatResponse(
            answer=analytics_response.answer,
            assistant_message_index=saved_chat.get("_assistantMessageIndex"),
            conversation_id=saved_chat.get("_id"),
            intent=intent,
            artifacts=analytics_response.artifacts,
            sources=[],
        )

    embeddings = EmbeddingService(settings.embedding_model)
    store = SQLiteVectorStore(settings.vector_db_path)
    retriever = RagRetriever(embeddings, store)
    contexts = retriever.search(request.message, filters=filters, limit=request.top_k)

    if not contexts:
        answer = (
            "No encontre informacion suficiente para responder eso. "
            "Prueba ajustando los viajes o la estacion seleccionada."
        )
        saved_chat = await chat_repository.append_exchange(
            answer=answer,
            artifacts=[],
            conversation_id=request.conversation_id,
            intent=intent,
            owner_id=request.scope.user_id or "anonymous",
            question=request.message,
            role=request.scope.role,
            scope=request.scope.model_dump(by_alias=True),
            sources=[],
        )
        return ChatResponse(
            answer=answer,
            assistant_message_index=saved_chat.get("_assistantMessageIndex"),
            conversation_id=saved_chat.get("_id"),
            intent=intent,
            artifacts=[],
            sources=[],
        )

    ollama = OllamaClient(settings.ollama_url, settings.chat_model)
    messages = build_rag_messages(request.message, contexts)
    answer = await ollama.chat(messages)
    sources = [context.to_source() for context in contexts]
    saved_chat = await chat_repository.append_exchange(
        answer=answer,
        artifacts=[],
        conversation_id=request.conversation_id,
        intent=intent,
        owner_id=request.scope.user_id or "anonymous",
        question=request.message,
        role=request.scope.role,
        scope=request.scope.model_dump(by_alias=True),
        sources=[source.model_dump() for source in sources],
    )

    return ChatResponse(
        answer=answer,
        assistant_message_index=saved_chat.get("_assistantMessageIndex"),
        conversation_id=saved_chat.get("_id"),
        intent=intent,
        artifacts=[],
        sources=sources,
    )
