from fastapi import APIRouter, Depends, HTTPException

from app.core.config import Settings, get_settings
from app.core.security import require_internal_token
from app.db.chat_repository import ChatRepository
from app.db.couch import CouchClient
from app.models.requests import ArtifactUpdateRequest
from app.models.responses import Artifact, ChatDetailResponse, ChatMessageResponse, ChatSummaryResponse

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[ChatSummaryResponse])
async def list_chats(
    ownerId: str,
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> list[ChatSummaryResponse]:
    repository = ChatRepository(CouchClient(settings.couchdb_url))
    chats = await repository.list_chats(ownerId)
    return [to_summary(chat) for chat in chats]


@router.get("/{chat_id}", response_model=ChatDetailResponse)
async def get_chat(
    chat_id: str,
    ownerId: str,
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> ChatDetailResponse:
    repository = ChatRepository(CouchClient(settings.couchdb_url))
    chat = await repository.get_chat(chat_id, ownerId)

    if not chat:
        raise HTTPException(status_code=404, detail="Chat no encontrado.")

    return ChatDetailResponse(
        **to_summary(chat).model_dump(),
        messages=[
            ChatMessageResponse(
                artifacts=message.get("artifacts") or [],
                content=str(message.get("content") or ""),
                createdAt=str(message.get("createdAt") or ""),
                messageIndex=index,
                intent=message.get("intent"),
                role=str(message.get("role") or ""),
                sources=message.get("sources") or [],
            )
            for index, message in enumerate(chat.get("messages") or [])
        ],
        scope=chat.get("scope"),
    )


@router.patch(
    "/{chat_id}/artifacts/{message_index}/{artifact_index}",
    response_model=Artifact,
)
async def update_artifact(
    chat_id: str,
    message_index: int,
    artifact_index: int,
    request: ArtifactUpdateRequest,
    ownerId: str,
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> Artifact:
    repository = ChatRepository(CouchClient(settings.couchdb_url))
    artifact = await repository.update_artifact(
        artifact_index=artifact_index,
        chart_type=request.chart_type,
        chat_id=chat_id,
        message_index=message_index,
        owner_id=ownerId,
    )

    if not artifact:
        raise HTTPException(status_code=404, detail="Resultado no encontrado.")

    return Artifact(**artifact)


def to_summary(chat: dict) -> ChatSummaryResponse:
    return ChatSummaryResponse(
        id=str(chat.get("_id") or ""),
        messageCount=int(chat.get("messageCount") or len(chat.get("messages") or [])),
        summary=str(chat.get("summary") or ""),
        title=str(chat.get("title") or "Consulta"),
        updatedAt=chat.get("updatedAt"),
    )
