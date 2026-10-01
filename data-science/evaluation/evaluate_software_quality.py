from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from statistics import mean
from time import perf_counter
from typing import Any, Awaitable, Callable

from app.analytics.dataframe_builder import build_story_rows
from app.analytics.stats import answer_with_statistics
from app.core.config import get_settings
from app.db.couch import CouchClient
from app.db.repositories import TesisRepository
from app.rag.embeddings import EmbeddingService
from app.rag.retrieval import RagRetriever
from app.rag.vector_store import SQLiteVectorStore

RUNS = 10
TRIP_ID = "viaje:seed:historias:01"
OUTPUT = Path(__file__).resolve().parent / "results" / "software-quality-2026-09-30.json"


async def measure(name: str, operation: Callable[[], Awaitable[Any]]) -> dict[str, Any]:
    durations: list[float] = []
    errors: list[str] = []
    for _ in range(RUNS):
        started = perf_counter()
        try:
            result = await operation()
            if result is None:
                raise RuntimeError("La operacion no devolvio resultado")
        except Exception as exc:
            errors.append(f"{type(exc).__name__}: {exc}")
        finally:
            durations.append(perf_counter() - started)
    return {
        "operation": name,
        "executions": RUNS,
        "successful": RUNS - len(errors),
        "errors": errors,
        "minimum_seconds": round(min(durations), 6),
        "maximum_seconds": round(max(durations), 6),
        "average_seconds": round(mean(durations), 6),
        "accepted": mean(durations) <= 3 and not errors,
    }


async def main() -> None:
    settings = get_settings()
    repository = TesisRepository(CouchClient(settings.couchdb_url))

    historias = await repository.fetch_historias(viaje_id=TRIP_ID)
    pacientes = await repository.fetch_pacientes()
    viajes = await repository.fetch_viajes()
    pacientes_by_id = {repository.doc_id(item): item for item in pacientes}
    rows = build_story_rows(historias, pacientes_by_id)

    retriever = RagRetriever(
        EmbeddingService(settings.embedding_model),
        SQLiteVectorStore(settings.vector_db_path),
    )
    retriever.search(
        "dolor epigastrico y nausea",
        filters={"viaje_id": TRIP_ID},
        limit=6,
    )

    async def local(value: Callable[[], Any]) -> Any:
        return value()

    operations = [
        await measure("Consulta de historias del viaje", lambda: repository.fetch_historias(viaje_id=TRIP_ID)),
        await measure("Consulta de pacientes", repository.fetch_pacientes),
        await measure("Consulta de viajes", repository.fetch_viajes),
        await measure("Consulta de actividades del viaje", lambda: repository.fetch_actividades(TRIP_ID)),
        await measure("Construccion de filas clinicas", lambda: local(lambda: build_story_rows(historias, pacientes_by_id))),
        await measure("Indicador de distribucion por genero", lambda: local(lambda: answer_with_statistics("Distribucion por genero", rows, "statistic", "table"))),
        await measure("Indicador promedio de glicemia", lambda: local(lambda: answer_with_statistics("Promedio de glicemia capilar", rows, "statistic", "table"))),
        await measure("Recuperacion RAG local", lambda: local(lambda: retriever.search("dolor epigastrico y nausea", filters={"viaje_id": TRIP_ID}, limit=6))),
    ]

    executions = sum(item["executions"] for item in operations)
    successful = sum(item["successful"] for item in operations)
    payload = {
        "executed_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "configuration": {"runs_per_operation": RUNS, "trip_id": TRIP_ID, "external_llm_included": False},
        "dataset": {"historias": len(historias), "pacientes": len(pacientes), "viajes": len(viajes)},
        "operations": operations,
        "reliability": {
            "executions": executions,
            "successful": successful,
            "errors": executions - successful,
            "percentage": round(successful / executions * 100, 2) if executions else 0,
            "accepted": successful / executions * 100 >= 95 if executions else False,
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
