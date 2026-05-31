import json
import sqlite3
from pathlib import Path
from typing import Any

import numpy as np

from app.models.documents import RagChunk, RetrievedChunk


class SQLiteVectorStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def replace_all(self, chunks: list[RagChunk], embeddings: np.ndarray) -> None:
        with sqlite3.connect(self.path) as conn:
            conn.execute("delete from chunks")
            conn.executemany(
                """
                insert into chunks (
                    chunk_id, document_id, document_type, title, text, metadata, embedding
                ) values (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        chunk.chunk_id,
                        chunk.document_id,
                        chunk.document_type,
                        chunk.title,
                        chunk.text,
                        json.dumps(chunk.metadata, ensure_ascii=False),
                        np.asarray(vector, dtype=np.float32).tobytes(),
                    )
                    for chunk, vector in zip(chunks, embeddings, strict=True)
                ],
            )

    def count(self) -> int:
        with sqlite3.connect(self.path) as conn:
            row = conn.execute("select count(*) from chunks").fetchone()
        return int(row[0])

    def search(
        self,
        query_embedding: np.ndarray,
        *,
        filters: dict[str, Any],
        limit: int,
    ) -> list[RetrievedChunk]:
        candidates = self._load_candidates(filters)
        if not candidates:
            return []

        query = np.asarray(query_embedding, dtype=np.float32).reshape(-1)
        results: list[RetrievedChunk] = []
        for chunk, embedding in candidates:
            score = float(np.dot(query, embedding))
            results.append(RetrievedChunk(**chunk.__dict__, score=score))

        results.sort(key=lambda item: item.score, reverse=True)
        return results[:limit]

    def _load_candidates(self, filters: dict[str, Any]) -> list[tuple[RagChunk, np.ndarray]]:
        with sqlite3.connect(self.path) as conn:
            rows = conn.execute(
                """
                select chunk_id, document_id, document_type, title, text, metadata, embedding
                from chunks
                """
            ).fetchall()

        candidates: list[tuple[RagChunk, np.ndarray]] = []
        for row in rows:
            metadata = json.loads(row[5])
            if not self._matches(metadata, filters):
                continue
            chunk = RagChunk(
                chunk_id=row[0],
                document_id=row[1],
                document_type=row[2],
                title=row[3],
                text=row[4],
                metadata=metadata,
            )
            embedding = np.frombuffer(row[6], dtype=np.float32)
            candidates.append((chunk, embedding))
        return candidates

    @staticmethod
    def _matches(metadata: dict[str, Any], filters: dict[str, Any]) -> bool:
        viaje_id = filters.get("viaje_id")
        viaje_ids = filters.get("viaje_ids") or ([viaje_id] if viaje_id else [])
        station_key = filters.get("station_key")
        selected_viaje_ids = set(viaje_ids)
        if selected_viaje_ids and metadata.get("viajeId") not in selected_viaje_ids:
            return False
        if station_key and metadata.get("stationKey") not in {station_key, None}:
            return False
        return True

    def _ensure_schema(self) -> None:
        with sqlite3.connect(self.path) as conn:
            conn.execute(
                """
                create table if not exists chunks (
                    chunk_id text primary key,
                    document_id text not null,
                    document_type text not null,
                    title text not null,
                    text text not null,
                    metadata text not null,
                    embedding blob not null
                )
                """
            )
