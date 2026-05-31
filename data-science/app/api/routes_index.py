from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.security import require_internal_token
from app.db.couch import CouchClient
from app.db.repositories import TesisRepository
from app.models.responses import IndexResponse
from app.rag.embeddings import EmbeddingService
from app.rag.indexer import RagIndexer
from app.rag.vector_store import SQLiteVectorStore

router = APIRouter(prefix="/index", tags=["index"])


def build_indexer(settings: Settings) -> RagIndexer:
    couch = CouchClient(settings.couchdb_url)
    repository = TesisRepository(couch)
    embeddings = EmbeddingService(settings.embedding_model)
    store = SQLiteVectorStore(settings.vector_db_path)
    return RagIndexer(repository, embeddings, store)


@router.post("/rebuild", response_model=IndexResponse)
async def rebuild_index(
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> IndexResponse:
    result = await build_indexer(settings).rebuild()
    return IndexResponse(**result)


@router.post("/sync", response_model=IndexResponse)
async def sync_index(
    _: None = Depends(require_internal_token),
    settings: Settings = Depends(get_settings),
) -> IndexResponse:
    result = await build_indexer(settings).sync()
    return IndexResponse(**result)
