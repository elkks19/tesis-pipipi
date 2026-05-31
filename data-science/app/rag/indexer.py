from app.db.repositories import TesisRepository
from app.rag.chunking import build_chunks
from app.rag.embeddings import EmbeddingService
from app.rag.vector_store import SQLiteVectorStore


class RagIndexer:
    def __init__(
        self,
        repository: TesisRepository,
        embeddings: EmbeddingService,
        store: SQLiteVectorStore,
    ) -> None:
        self.repository = repository
        self.embeddings = embeddings
        self.store = store

    async def rebuild(self) -> dict[str, object]:
        historias = await self.repository.fetch_historias()
        pacientes = await self.repository.fetch_pacientes()
        viajes = await self.repository.fetch_viajes()

        pacientes_by_id = {self.repository.doc_id(paciente): paciente for paciente in pacientes}
        viajes_by_id = {self.repository.doc_id(viaje): viaje for viaje in viajes}

        chunks = build_chunks(historias, pacientes_by_id, viajes_by_id)
        vectors = self.embeddings.encode([chunk.text for chunk in chunks]) if chunks else []
        self.store.replace_all(chunks, vectors)

        return {
            "ok": True,
            "indexed_chunks": self.store.count(),
            "historias": len(historias),
            "pacientes": len(pacientes),
            "viajes": len(viajes),
            "detail": "Indice reconstruido correctamente.",
        }

    async def sync(self) -> dict[str, object]:
        return await self.rebuild()
