from functools import lru_cache

import numpy as np


@lru_cache(maxsize=2)
def load_embedding_model(model_name: str):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


class EmbeddingService:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    @property
    def model(self):
        return load_embedding_model(self.model_name)

    def encode(self, texts: list[str]) -> np.ndarray:
        vectors = self.model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return np.asarray(vectors, dtype=np.float32)
