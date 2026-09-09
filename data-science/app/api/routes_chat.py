from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.agent.orchestrator import ResearchAgent, ResearchAgentStreamer
from app.agent.tools import ResearchTools
from app.analytics.dataframe_builder import build_story_rows
from app.analytics.intent import detect_intent
from app.analytics.stats import answer_with_statistics
from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.core.security import require_internal_token
from app.db.chat_repository import ChatRepository
from app.db.couch import CouchClient
from app.db.repositories import TesisRepository
from app.llm.client import build_chat_client
from app.models.requests import ChatRequest
from app.models.responses import ChatResponse
from app.rag.embeddings import EmbeddingService
from app.rag.retrieval import RagRetriever
from app.rag.vector_store import SQLiteVectorStore

router = APIRouter(tags=["chat"])
logger = get_logger(__name__)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    filters = request.scope.to_filters()

    couch = CouchClient(settings.couchdb_url)
    repository = TesisRepository(couch)
    chat_repository = ChatRepository(couch)
    chat_client = build_chat_client(settings)
    owner_id = request.scope.user_id or "anonymous"
    history = await chat_repository.get_context_messages(
        request.conversation_id,
        owner_id,
    )

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
    agent = ResearchAgent(chat_client, tools)

    agent_response = await agent.answer(request.message, history=history)

    saved_chat = await chat_repository.append_exchange(
        answer=agent_response.answer,
        artifacts=[artifact.model_dump() for artifact in agent_response.artifacts],
        conversation_id=request.conversation_id,
        intent="agent",
        owner_id=owner_id,
        question=request.message,
        role=request.scope.role,
        scope=request.scope.model_dump(by_alias=True),
        sources=[source.model_dump() for source in agent_response.sources],
    )

    return ChatResponse(
        answer=agent_response.answer,
        assistant_message_index=saved_chat.get("_assistantMessageIndex"),
        conversation_id=saved_chat.get("_id"),
        intent="agent",
        artifacts=agent_response.artifacts,
        sources=agent_response.sources,
    )


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    import json as _json

    filters = request.scope.to_filters()
    couch = CouchClient(settings.couchdb_url)
    repository = TesisRepository(couch)
    chat_repository = ChatRepository(couch)
    chat_client = build_chat_client(settings)
    logger.info(
        "Chat stream request provider=%s model=%s user=%s role=%s",
        settings.llm_provider,
        settings.chat_model,
        request.scope.user_id or "anonymous",
        request.scope.role or "unknown",
    )
    owner_id = request.scope.user_id or "anonymous"
    history = await chat_repository.get_context_messages(
        request.conversation_id,
        owner_id,
    )

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
    streamer = ResearchAgentStreamer(chat_client, tools)

    async def event_stream():
        try:
            yield f"data: {_json.dumps({'type': 'status', 'data': f'LLM: {settings.llm_provider} / {settings.chat_model}'}, ensure_ascii=False)}\n\n"
            yield f"data: {_json.dumps({'type': 'status', 'data': 'Preparando consulta y herramientas...'}, ensure_ascii=False)}\n\n"

            intent = detect_intent(request.message)
            if intent in {"chart", "statistic"}:
                historias = await repository.fetch_historias(**filters)
                pacientes = await repository.fetch_pacientes_for_historias(historias)
                rows = build_story_rows(historias, pacientes)
                deterministic = answer_with_statistics(
                    request.message,
                    rows,
                    intent,
                    request.chart_type,
                )
                if deterministic.artifacts:
                    yield f"data: {_json.dumps({'type': 'artifacts', 'data': [a.model_dump() for a in deterministic.artifacts]}, ensure_ascii=False)}\n\n"
                yield f"data: {_json.dumps({'type': 'token', 'data': deterministic.answer}, ensure_ascii=False)}\n\n"
                saved_chat = await chat_repository.append_exchange(
                    answer=deterministic.answer,
                    artifacts=[a.model_dump() for a in deterministic.artifacts],
                    conversation_id=request.conversation_id,
                    intent=intent,
                    owner_id=owner_id,
                    question=request.message,
                    role=request.scope.role,
                    scope=request.scope.model_dump(by_alias=True),
                    sources=[],
                )
                yield f"data: {_json.dumps({'type': 'done', 'data': {'conversation_id': saved_chat.get('_id'), 'assistant_message_index': saved_chat.get('_assistantMessageIndex'), 'intent': intent}}, ensure_ascii=False)}\n\n"
                return

            preamble = await streamer.prepare(request.message, history=history)

            # Send artifacts/sources before streaming text
            if preamble.artifacts:
                yield f"data: {_json.dumps({'type': 'artifacts', 'data': [a.model_dump() for a in preamble.artifacts]}, ensure_ascii=False)}\n\n"
            if preamble.sources:
                yield f"data: {_json.dumps({'type': 'sources', 'data': [s.model_dump() for s in preamble.sources]}, ensure_ascii=False)}\n\n"

            # Check if the last message already has the answer (no tools called)
            last_msg = preamble.messages[-1] if preamble.messages else {}
            if last_msg.get("role") == "assistant" and last_msg.get("content"):
                from app.llm.ollama_client import strip_thinking as _strip
                text = _strip(str(last_msg.get("content") or "")).strip()
                if text:
                    yield f"data: {_json.dumps({'type': 'token', 'data': text}, ensure_ascii=False)}\n\n"
                    full_answer = text
                else:
                    full_answer = ""
            else:
                # Stream the final answer
                yield f"data: {_json.dumps({'type': 'status', 'data': 'Redactando respuesta...'}, ensure_ascii=False)}\n\n"
                full_answer = ""
                async for token in streamer.stream_answer(preamble):
                    full_answer += token
                    yield f"data: {_json.dumps({'type': 'token', 'data': token}, ensure_ascii=False)}\n\n"

            if not full_answer:
                full_answer = "No encontre informacion suficiente para responder eso."
                yield f"data: {_json.dumps({'type': 'token', 'data': full_answer}, ensure_ascii=False)}\n\n"

            # Save to chat history
            saved_chat = await chat_repository.append_exchange(
                answer=full_answer,
                artifacts=[a.model_dump() for a in preamble.artifacts],
                conversation_id=request.conversation_id,
                intent="agent",
                owner_id=owner_id,
                question=request.message,
                role=request.scope.role,
                scope=request.scope.model_dump(by_alias=True),
                sources=[s.model_dump() for s in preamble.sources],
            )

            # Send final metadata
            yield f"data: {_json.dumps({'type': 'done', 'data': {'conversation_id': saved_chat.get('_id'), 'assistant_message_index': saved_chat.get('_assistantMessageIndex'), 'intent': 'agent'}}, ensure_ascii=False)}\n\n"

        except Exception as exc:
            import logging
            logging.exception("Stream error: %s", exc)
            yield f"data: {_json.dumps({'type': 'error', 'data': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
