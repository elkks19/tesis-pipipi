from typing import Any

from app.models.documents import RetrievedChunk
from app.rag.embeddings import EmbeddingService
from app.rag.vector_store import SQLiteVectorStore


class RagRetriever:
    def __init__(self, embeddings: EmbeddingService, store: SQLiteVectorStore) -> None:
        self.embeddings = embeddings
        self.store = store

    def search(
        self,
        query: str,
        *,
        filters: dict[str, Any],
        limit: int,
    ) -> list[RetrievedChunk]:
        query_embedding = self.embeddings.encode([query])[0]
        return self.store.search(query_embedding, filters=filters, limit=limit)
