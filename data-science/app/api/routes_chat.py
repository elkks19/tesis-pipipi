from collections.abc import Callable

from fastapi import APIRouter, Depends

from app.agent.orchestrator import ResearchAgent
from app.agent.tools import ResearchTools
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
from app.models.responses import Artifact, ChatResponse, Source
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
    ollama = OllamaClient(settings.ollama_url, settings.chat_model)

    def build_retriever() -> RagRetriever:
        embeddings = EmbeddingService(settings.embedding_model)
        store = SQLiteVectorStore(settings.vector_db_path)
        return RagRetriever(embeddings, store)

    tools = ResearchTools(
        repository,
        filters=filters,
        chart_type=request.chart_type,
        retriever_factory=build_retriever,
    )
    agent = ResearchAgent(ollama, tools)

    try:
        agent_response = await agent.answer(request.message)
        answer = agent_response.answer
        artifacts = agent_response.artifacts
        sources = agent_response.sources
        response_intent = "agent"
        if intent in {"chart", "statistic"} and not artifacts:
            answer, artifacts, sources = await legacy_answer(
                message=request.message,
                intent=intent,
                chart_type=request.chart_type,
                filters=filters,
                repository=repository,
                retriever_factory=build_retriever,
                ollama=ollama,
                top_k=request.top_k,
            )
            response_intent = intent
    except Exception:
        answer, artifacts, sources = await legacy_answer(
            message=request.message,
            intent=intent,
            chart_type=request.chart_type,
            filters=filters,
            repository=repository,
            retriever_factory=build_retriever,
            ollama=ollama,
            top_k=request.top_k,
        )
        response_intent = intent

    saved_chat = await chat_repository.append_exchange(
        answer=answer,
        artifacts=[artifact.model_dump() for artifact in artifacts],
        conversation_id=request.conversation_id,
        intent=response_intent,
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
        intent=response_intent,
        artifacts=artifacts,
        sources=sources,
    )


async def legacy_answer(
    *,
    message: str,
    intent: str,
    chart_type: str,
    filters: dict[str, str | list[str] | None],
    repository: TesisRepository,
    retriever_factory: Callable[[], RagRetriever],
    ollama: OllamaClient,
    top_k: int,
) -> tuple[str, list[Artifact], list[Source]]:
    if intent in {"chart", "statistic"}:
        historias = await repository.fetch_historias(**filters)
        pacientes = await repository.fetch_pacientes_for_historias(historias)
        rows = build_story_rows(historias, pacientes)
        analytics_response = answer_with_statistics(message, rows, intent, chart_type)
        return analytics_response.answer, analytics_response.artifacts, []

    contexts = retriever_factory().search(message, filters=filters, limit=top_k)
    if not contexts:
        return (
            (
                "No encontre informacion suficiente para responder eso. "
                "Prueba ajustando los viajes o la estacion seleccionada."
            ),
            [],
            [],
        )

    messages = build_rag_messages(message, contexts)
    answer = await ollama.chat(messages)
    return answer, [], [context.to_source() for context in contexts]
