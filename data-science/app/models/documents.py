from dataclasses import dataclass
from typing import Any

from app.models.responses import Source


@dataclass(frozen=True)
class RagChunk:
    chunk_id: str
    document_id: str
    document_type: str
    title: str
    text: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class RetrievedChunk(RagChunk):
    score: float

    def to_source(self) -> Source:
        return Source(
            chunk_id=self.chunk_id,
            document_id=self.document_id,
            document_type=self.document_type,
            title=self.title,
            score=self.score,
            metadata=self.metadata,
        )
