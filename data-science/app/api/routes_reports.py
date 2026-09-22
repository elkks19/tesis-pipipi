from fastapi import APIRouter, Depends

from app.analytics.dataframe_builder import build_story_rows
from app.analytics.reports import build_report
from app.core.config import Settings, get_settings
from app.core.security import require_internal_token
from app.db.chat_repository import ChatRepository
from app.db.couch import CouchClient
from app.db.repositories import TesisRepository
from app.models.requests import ReportRequest
from app.models.responses import ChatResponse

router = APIRouter(tags=["reports"])

REPORT_QUESTIONS = {
    "general": "Generar reporte estadistico",
    "perfil_epidemiologico": "Generar perfil epidemiologico",
    "diagnosticos_poblacion": "Generar reporte de diagnosticos por poblacion",
}


@router.post("/reports", response_model=ChatResponse)
async def generate_report(
    request: ReportRequest,
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> ChatResponse:
    couch = CouchClient(settings.couchdb_url)
    repository = TesisRepository(couch)
    historias = await repository.fetch_historias(**request.scope.to_filters())
    pacientes = await repository.fetch_pacientes_for_historias(historias)
    report = build_report(build_story_rows(historias, pacientes), request.report_type)
    question = REPORT_QUESTIONS.get(request.report_type, REPORT_QUESTIONS["general"])
    saved_chat = None
    if request.save_to_conversation:
        saved_chat = await ChatRepository(couch).append_exchange(
            answer=report.answer,
            artifacts=[artifact.model_dump() for artifact in report.artifacts],
            conversation_id=request.conversation_id,
            intent="report",
            owner_id=request.scope.user_id or "anonymous",
            question=question,
            role=request.scope.role,
            scope=request.scope.model_dump(by_alias=True),
            sources=[],
        )

    return ChatResponse(
        answer=report.answer,
        assistant_message_index=saved_chat.get("_assistantMessageIndex") if saved_chat else None,
        conversation_id=saved_chat.get("_id") if saved_chat else request.conversation_id,
        intent="report",
        artifacts=report.artifacts,
        sources=[],
    )
