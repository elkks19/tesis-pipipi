from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.security import require_internal_token
from app.db.couch import CouchClient
from app.llm.client import build_chat_client
from app.models.responses import HealthResponse, ModelStatusResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    couch = CouchClient(settings.couchdb_url)
    chat_client = build_chat_client(settings)

    couch_ok, couch_detail = await couch.check()
    indexes_ok = False
    indexes_detail = "No se prepararon indices porque CouchDB no respondio."
    if couch_ok:
        try:
            await couch.ensure_indexes()
            indexes_ok = True
            indexes_detail = "Indices de consulta listos."
        except Exception as exc:
            indexes_detail = str(exc)

    ollama_ok, ollama_detail = await chat_client.check()

    return HealthResponse(
        ok=couch_ok and indexes_ok,
        couchdb={"ok": couch_ok, "detail": couch_detail},
        indexes={"ok": indexes_ok, "detail": indexes_detail},
        ollama={"ok": ollama_ok, "detail": ollama_detail},
        storage_dir=str(settings.storage_dir),
        chat_model=settings.chat_model,
        embedding_model=settings.embedding_model,
    )


@router.get("/models/status", response_model=ModelStatusResponse)
async def model_status(
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> ModelStatusResponse:
    chat_client = build_chat_client(settings)
    ok, detail = await chat_client.check()
    return ModelStatusResponse(
        ok=ok,
        provider=settings.llm_provider,
        chat_model=settings.chat_model,
        embedding_model=settings.embedding_model,
        detail=detail,
    )
