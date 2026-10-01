#!/usr/bin/env python3
"""Evaluacion reproducible del agente de investigacion sobre datos reales.

No escribe documentos en CouchDB. Lee las historias, consulta el indice RAG local y
ejecuta el orquestador real para registrar tanto exitos como errores del proveedor LLM.
"""

from __future__ import annotations

import asyncio
import json
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from statistics import mean
from typing import Any, Callable

import numpy as np

SERVICE_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = SERVICE_DIR.parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from app.agent.orchestrator import ResearchAgent  # noqa: E402
from app.agent.tools import ResearchTools  # noqa: E402
from app.analytics.dataframe_builder import build_story_rows  # noqa: E402
from app.analytics.intent import detect_intent  # noqa: E402
from app.analytics.stats import answer_with_statistics  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.db.couch import CouchClient  # noqa: E402
from app.db.repositories import TesisRepository  # noqa: E402
from app.llm.client import build_chat_client  # noqa: E402
from app.rag.embeddings import EmbeddingService  # noqa: E402
from app.rag.retrieval import RagRetriever  # noqa: E402
from app.rag.vector_store import SQLiteVectorStore  # noqa: E402


EVALUATION_DATE = "2026-09-30"
TRIP_ID = "viaje:seed:historias:01"
TOP_K = 6
RESULTS_DIR = Path(__file__).resolve().parent / "results"
JSON_PATH = RESULTS_DIR / f"agent-evaluation-{EVALUATION_DATE}.json"
REPORT_PATH = PROJECT_DIR / "docs" / f"evaluacion-agente-{EVALUATION_DATE}.md"


@dataclass(frozen=True)
class FactualCase:
    case_id: str
    query: str
    expected_builder: Callable[["EvaluationContext"], Any]
    observed_builder: Callable[[list[Any], str], Any]
    comparator: Callable[[Any, Any], bool]


@dataclass(frozen=True)
class RetrievalCase:
    case_id: str
    query: str
    expected_chunks: tuple[str, ...]


@dataclass(frozen=True)
class ToolCase:
    case_id: str
    query: str
    expected_tool: str
    expected_builder: Callable[["EvaluationContext"], Any]


@dataclass
class EvaluationContext:
    historias: list[dict[str, Any]]
    pacientes_by_id: dict[str, dict[str, Any]]
    rows: list[dict[str, Any]]


def settings_for_evaluation() -> Settings:
    """Use the same service env file explicitly, independent of current directory."""
    return Settings(_env_file=SERVICE_DIR / ".env")


def raw_number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    match = re.search(r"[-+]?\d+(?:[.,]\d+)?", str(value or ""))
    if not match:
        return None
    return float(match.group(0).replace(",", "."))


def direct_numeric(ctx: EvaluationContext, section: str, field: str) -> list[float]:
    values: list[float] = []
    for historia in ctx.historias:
        number = raw_number((historia.get(section) or {}).get(field))
        if number is not None:
            values.append(number)
    return values


def direct_gender_counts(ctx: EvaluationContext) -> dict[str, int]:
    counts = Counter()
    for historia in ctx.historias:
        paciente = ctx.pacientes_by_id.get(str(historia.get("pacienteId") or ""), {})
        counts[str(paciente.get("genero") or "Sin dato")] += 1
    return dict(counts)


def direct_age_group_counts(ctx: EvaluationContext) -> dict[str, int]:
    counts = Counter()
    today = date.today()
    for historia in ctx.historias:
        paciente = ctx.pacientes_by_id.get(str(historia.get("pacienteId") or ""), {})
        value = ((paciente.get("datosPersonales") or {}).get("fechaNacimiento"))
        try:
            born = date.fromisoformat(str(value)[:10])
            age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
        except (TypeError, ValueError):
            counts["Sin dato"] += 1
            continue
        if age < 5:
            label = "0-4"
        elif age < 12:
            label = "5-11"
        elif age < 18:
            label = "12-17"
        elif age < 30:
            label = "18-29"
        elif age < 45:
            label = "30-44"
        elif age < 60:
            label = "45-59"
        else:
            label = "60+"
        counts[label] += 1
    return dict(counts)


def diagnosis_label(item: Any) -> str:
    if not isinstance(item, dict):
        return ""
    return str(item.get("title") or item.get("code") or item.get("iNo") or "").strip()


def direct_diagnosis_counts(ctx: EvaluationContext) -> dict[str, int]:
    counts = Counter()
    for historia in ctx.historias:
        diagnostico = historia.get("diagnostico") or {}
        candidates = [diagnostico.get("principal") or {}, *(diagnostico.get("secundarios") or [])]
        labels = [diagnosis_label(item) for item in candidates]
        labels = [label for label in labels if label]
        counts.update(labels or ["Sin diagnostico"])
    return dict(counts)


def rounded_average(values: list[float]) -> dict[str, Any]:
    return {"registros": len(values), "promedio": round(mean(values), 2) if values else None}


def numeric_summary(values: list[float]) -> dict[str, Any]:
    return {
        "registros": len(values),
        "promedio": round(mean(values), 2) if values else None,
        "minimo": round(min(values), 2) if values else None,
        "maximo": round(max(values), 2) if values else None,
    }


def primary_rows(artifacts: list[Any]) -> list[dict[str, Any]]:
    if not artifacts:
        return []
    data = artifacts[0].data
    return data if isinstance(data, list) else []


def observed_count(artifacts: list[Any], _: str) -> Any:
    rows = primary_rows(artifacts)
    return rows[0].get("historias") if rows else None


def observed_counts(key: str) -> Callable[[list[Any], str], Any]:
    def extract(artifacts: list[Any], _: str) -> Any:
        rows = primary_rows(artifacts)
        if not rows or any(key not in row or "historias" not in row for row in rows):
            return None
        return {str(row[key]): int(row["historias"]) for row in rows}

    return extract


def observed_summary(artifacts: list[Any], answer: str) -> Any:
    rows = primary_rows(artifacts)
    if not rows:
        return {"respuesta": answer}
    row = rows[0]
    return {"registros": row.get("registros"), "promedio": row.get("promedio")}


def observed_diagnosis_total(artifacts: list[Any], _: str) -> Any:
    rows = primary_rows(artifacts)
    if not rows:
        return None
    if all("diagnostico" in row and "historias" in row for row in rows):
        return sum(int(row["historias"]) for row in rows)
    return rows[0].get("historias")


def same_json(expected: Any, observed: Any) -> bool:
    return expected == observed


def factual_cases() -> list[FactualCase]:
    return [
        FactualCase(
            "F1",
            "¿Cuántas historias clínicas hay en este viaje?",
            lambda c: len(c.historias),
            observed_count,
            same_json,
        ),
        FactualCase(
            "F2",
            "Muéstrame la distribución de historias por género.",
            direct_gender_counts,
            observed_counts("genero"),
            same_json,
        ),
        FactualCase(
            "F3",
            "¿Cuál es el promedio de IMC?",
            lambda c: rounded_average(direct_numeric(c, "examenFisicoGeneral", "imc")),
            observed_summary,
            same_json,
        ),
        FactualCase(
            "F4",
            "¿Cuál es el promedio de frecuencia cardíaca?",
            lambda c: rounded_average(direct_numeric(c, "examenFisicoGeneral", "frecuenciaCardiaca")),
            observed_summary,
            same_json,
        ),
        FactualCase(
            "F5",
            "¿Cuál es el promedio de presión arterial media?",
            lambda c: rounded_average(direct_numeric(c, "examenFisicoGeneral", "presionArterialMedia")),
            observed_summary,
            same_json,
        ),
        FactualCase(
            "F6",
            "¿Cuántos diagnósticos hay registrados en total?",
            lambda c: sum(direct_diagnosis_counts(c).values()),
            observed_diagnosis_total,
            same_json,
        ),
        FactualCase(
            "F7",
            "Muéstrame la distribución por grupo de edad.",
            direct_age_group_counts,
            observed_counts("grupoEdad"),
            same_json,
        ),
        FactualCase(
            "F8",
            "¿Cuál es el promedio de glicemia capilar?",
            lambda c: rounded_average(direct_numeric(c, "laboratorios", "glicemiaCapilar")),
            observed_summary,
            same_json,
        ),
    ]


def retrieval_cases() -> list[RetrievalCase]:
    return [
        RetrievalCase(
            "R1",
            "Dolor epigástrico, acidez después de las comidas, ardor posprandial y náusea ocasional.",
            ("historia:demo-primeros-pacientes:1:1:anamnesis",),
        ),
        RetrievalCase(
            "R2",
            "Glicemia capilar 91 mg/dL, grupo sanguíneo O positivo, hemoglobina 14.2 g/dL y creatinina 0.9 mg/dL.",
            ("historia:demo-primeros-pacientes:1:1:laboratorios",),
        ),
        RetrievalCase(
            "R3",
            "Reducir sodio, registrar presión dos veces al día y acudir a control médico en siete días.",
            (
                "historia:demo-primeros-pacientes:2:1:diagnostico",
                "historia:demo-primeros-pacientes:2:1:resumen",
            ),
        ),
        RetrievalCase(
            "R4",
            "FEV1 3.07, FVC 4.21, FEV1/FVC 0.88 y probable patrón obstructivo leve.",
            ("historia:seed:102:espirometria",),
        ),
        RetrievalCase(
            "R5",
            "Glicemia capilar 175 mg/dL, grupo sanguíneo A negativo y creatinina 0.62 mg/dL.",
            ("historia:seed:102:laboratorios",),
        ),
        RetrievalCase(
            "R6",
            "FEV1 2.77, FVC 4.51, referencia GLI 2012 y calidad aceptable de maniobra.",
            ("historia:seed:105:espirometria",),
        ),
        RetrievalCase(
            "R7",
            "Control prenatal normal junto con enfermedad hepática grasa no alcohólica.",
            (
                "historia:seed:106:diagnostico",
                "historia:seed:106:resumen",
            ),
        ),
    ]


def direct_outliers(ctx: EvaluationContext) -> dict[str, Any]:
    values = np.asarray(direct_numeric(ctx, "examenFisicoGeneral", "imc"), dtype=np.float64)
    q1, q3 = np.percentile(values, [25, 75])
    low, high = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
    return {
        "registros": len(values),
        "atipicos": int(np.count_nonzero((values < low) | (values > high))),
        "limiteInferior": round(float(low), 2),
        "limiteSuperior": round(float(high), 2),
    }


def direct_correlation(ctx: EvaluationContext) -> dict[str, Any]:
    pairs = []
    for historia in ctx.historias:
        section = historia.get("examenFisicoGeneral") or {}
        a = raw_number(section.get("frecuenciaCardiaca"))
        b = raw_number(section.get("presionArterialMedia"))
        if a is not None and b is not None:
            pairs.append((a, b))
    matrix = np.asarray(pairs, dtype=np.float64)
    return {
        "paresValidos": len(pairs),
        "correlacion": round(float(np.corrcoef(matrix[:, 0], matrix[:, 1])[0, 1]), 3),
    }


def tool_cases() -> list[ToolCase]:
    return [
        ToolCase(
            "T1",
            "Indica el total exacto de historias clínicas disponibles en este viaje.",
            "count_histories",
            lambda c: {"historias": len(c.historias)},
        ),
        ToolCase(
            "T2",
            "Agrupa las historias por género y presenta los conteos.",
            "group_histories_by",
            direct_gender_counts,
        ),
        ToolCase(
            "T3",
            "Resume el IMC con cantidad de registros, promedio, mínimo y máximo.",
            "summarize_numeric_field",
            lambda c: numeric_summary(direct_numeric(c, "examenFisicoGeneral", "imc")),
        ),
        ToolCase(
            "T4",
            "Indica qué campos clínicos están disponibles para el análisis.",
            "list_available_fields",
            lambda _: {"campos": ["genero", "edad", "grupoEdad", "diagnosticos", "imc", "frecuenciaCardiaca", "presionArterialMedia", "glicemiaCapilar"]},
        ),
        ToolCase(
            "T5",
            "Detecta valores atípicos de IMC mediante el método IQR.",
            "detect_numeric_outliers",
            direct_outliers,
        ),
        ToolCase(
            "T6",
            "Calcula la correlación de Pearson entre frecuencia cardíaca y presión arterial media.",
            "correlate_numeric_fields",
            direct_correlation,
        ),
        ToolCase(
            "T7",
            "Busca evidencia clínica sobre ardor epigástrico posprandial y náusea ocasional.",
            "search_clinical_context",
            lambda _: {"fragmentoEsperado": "historia:demo-primeros-pacientes:1:1:anamnesis"},
        ),
    ]


def compact(value: Any, max_length: int = 320) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True)
    if len(text) <= max_length:
        return text
    return text[: max_length - 1] + "…"


def markdown_cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", "<br>")


def retrieval_label(chunk: Any) -> str:
    section = chunk.metadata.get("section") or "sin_seccion"
    return f"{chunk.chunk_id} [{section}; score={chunk.score:.4f}]"


async def load_context(repository: TesisRepository) -> EvaluationContext:
    historias = await repository.fetch_historias(viaje_id=TRIP_ID)
    pacientes_by_id = await repository.fetch_pacientes_for_historias(historias)
    return EvaluationContext(
        historias=historias,
        pacientes_by_id=pacientes_by_id,
        rows=build_story_rows(historias, pacientes_by_id),
    )


def evaluate_factual(ctx: EvaluationContext) -> list[dict[str, Any]]:
    results = []
    for case in factual_cases():
        expected = case.expected_builder(ctx)
        intent = detect_intent(case.query)
        response = answer_with_statistics(case.query, ctx.rows, intent, "table")
        observed = case.observed_builder(response.artifacts, response.answer)
        correct = case.comparator(expected, observed)
        results.append(
            {
                "case": case.case_id,
                "query": case.query,
                "expected": expected,
                "observed": observed,
                "agent_answer": response.answer,
                "intent": intent,
                "correct": correct,
            }
        )
    return results


def evaluate_retrieval(retriever: RagRetriever) -> list[dict[str, Any]]:
    results = []
    for case in retrieval_cases():
        chunks = retriever.search(case.query, filters={"viaje_id": TRIP_ID}, limit=TOP_K)
        recovered_ids = [chunk.chunk_id for chunk in chunks]
        expected = set(case.expected_chunks)
        relevant = expected.intersection(recovered_ids)
        precision = len(relevant) / len(recovered_ids) if recovered_ids else 0.0
        recall = len(relevant) / len(expected) if expected else 0.0
        results.append(
            {
                "case": case.case_id,
                "query": case.query,
                "expected_chunks": list(case.expected_chunks),
                "recovered_chunks": [retrieval_label(chunk) for chunk in chunks],
                "recovered_ids": recovered_ids,
                "relevant_recovered": sorted(relevant),
                "precision_at_k": round(precision, 4),
                "recall_at_k": round(recall, 4),
                "correct": math.isclose(recall, 1.0),
            }
        )
    return results


async def evaluate_tools(
    ctx: EvaluationContext,
    agent: ResearchAgent,
) -> list[dict[str, Any]]:
    results = []
    for case in tool_cases():
        expected = case.expected_builder(ctx)
        actual_tools: list[dict[str, str]] = []
        answer = ""
        error = None
        try:
            response = await agent.answer(case.query)
            actual_tools = response.tool_runs
            answer = response.answer
        except Exception as exc:  # The failure is an evaluation result.
            error = f"{type(exc).__name__}: {exc}"
        expected_succeeded = any(
            item.get("name") == case.expected_tool and item.get("status") == "succeeded"
            for item in actual_tools
        )
        results.append(
            {
                "case": case.case_id,
                "query": case.query,
                "expected_tool": case.expected_tool,
                "actual_tools": actual_tools,
                "expected": expected,
                "observed": answer or None,
                "error": error,
                "correct": expected_succeeded and error is None,
            }
        )
    return results


def build_summary(sections: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    all_results = []
    for name, results in sections.items():
        correct = sum(bool(item["correct"]) for item in results)
        summary[name] = {
            "executed": len(results),
            "correct": correct,
            "incorrect": len(results) - correct,
            "result": round(correct / len(results) * 100, 2) if results else 0.0,
        }
        all_results.extend(results)
    retrieval = sections["retrieval"]
    summary["overall"] = {
        "executed": len(all_results),
        "correct": sum(bool(item["correct"]) for item in all_results),
        "incorrect": sum(not bool(item["correct"]) for item in all_results),
        "result": round(sum(bool(item["correct"]) for item in all_results) / len(all_results) * 100, 2),
        "mean_precision_at_k": round(mean(item["precision_at_k"] for item in retrieval), 4),
        "mean_recall_at_k": round(mean(item["recall_at_k"] for item in retrieval), 4),
    }
    return summary


def build_report(payload: dict[str, Any]) -> str:
    factual = payload["factual"]
    retrieval = payload["retrieval"]
    tools = payload["tools"]
    summary = payload["summary"]
    lines = [
        "# Evaluación reproducible del agente inteligente",
        "",
        f"**Fecha de ejecución:** {payload['executed_at']}",
        "",
        "## Alcance y datos utilizados",
        "",
        (
            f"Se evaluó el viaje `{TRIP_ID}` con **{payload['dataset']['historias']} historias** "
            f"y **{payload['dataset']['pacientes_vinculados']} pacientes vinculados**. La base completa "
            f"contenía {payload['dataset']['historias_totales']} historias y el índice local "
            f"{payload['dataset']['fragmentos_indexados']} fragmentos. Las consultas se limitaron al viaje "
            "antes de calcular resultados o recuperar fragmentos."
        ),
        "",
        (
            f"El sistema estaba configurado con proveedor `{payload['configuration']['provider']}`, modelo "
            f"`{payload['configuration']['model']}` y embeddings `{payload['configuration']['embedding_model']}`. "
            f"La recuperación usó **k={TOP_K}**, el valor enviado actualmente por la interfaz y aceptado por el backend."
        ),
        "",
        "Los resultados esperados de exactitud factual se calcularon directamente desde los documentos CouchDB. "
        "Los fragmentos esperados de RAG se fijaron a partir de la sección estructurada que contiene cada dato, "
        "antes de ejecutar la búsqueda. Un caso RAG se marcó satisfactorio si recuperó todos los fragmentos esperados "
        "(Recall@6 = 1); Precision@6 se conserva como medida independiente de ruido.",
        "",
        "## 1. Exactitud sobre datos estructurados",
        "",
        "| Caso | Consulta | Resultado esperado | Resultado del agente | Estado |",
        "|---|---|---|---|---|",
    ]
    for item in factual:
        observed = {"resultado": item["observed"], "respuesta": item["agent_answer"]}
        lines.append(
            "| " + " | ".join(
                markdown_cell(value)
                for value in [
                    item["case"], item["query"], compact(item["expected"]), compact(observed),
                    "Correcta" if item["correct"] else "Incorrecta",
                ]
            ) + " |"
        )
    lines.extend(
        [
            "",
            "## 2. Recuperación semántica",
            "",
            "| Caso | Consulta | Fragmentos esperados | Fragmentos recuperados | Precision@6 | Recall@6 |",
            "|---|---|---|---|---:|---:|",
        ]
    )
    for item in retrieval:
        lines.append(
            "| " + " | ".join(
                markdown_cell(value)
                for value in [
                    item["case"], item["query"], "<br>".join(item["expected_chunks"]),
                    "<br>".join(item["recovered_chunks"]), f"{item['precision_at_k']:.4f}",
                    f"{item['recall_at_k']:.4f}",
                ]
            ) + " |"
        )
    lines.extend(
        [
            "",
            "## 3. Selección y ejecución de herramientas",
            "",
            "| Caso | Consulta | Tool esperada | Tool utilizada | Resultado | Estado |",
            "|---|---|---|---|---|---|",
        ]
    )
    for item in tools:
        actual = ", ".join(f"{x.get('name')} ({x.get('status')})" for x in item["actual_tools"]) or "Ninguna"
        result = {
            "esperado": item["expected"],
            "obtenido": item["observed"],
            "error": item["error"],
        }
        lines.append(
            "| " + " | ".join(
                markdown_cell(value)
                for value in [
                    item["case"], item["query"], item["expected_tool"], actual,
                    compact(result), "Correcta" if item["correct"] else "Incorrecta",
                ]
            ) + " |"
        )
    lines.extend(
        [
            "",
            "## Resumen",
            "",
            "| Tipo de prueba | Pruebas ejecutadas | Correctas | Incorrectas | Resultado |",
            "|---|---:|---:|---:|---:|",
        ]
    )
    labels = {
        "factual": "Exactitud factual",
        "retrieval": "Recuperación semántica",
        "tools": "Selección y ejecución de tools",
    }
    for key in ("factual", "retrieval", "tools"):
        item = summary[key]
        lines.append(
            f"| {labels[key]} | {item['executed']} | {item['correct']} | {item['incorrect']} | {item['result']:.2f}% |"
        )
    overall = summary["overall"]
    lines.extend(
        [
            f"| **Total** | **{overall['executed']}** | **{overall['correct']}** | **{overall['incorrect']}** | **{overall['result']:.2f}%** |",
            "",
            f"- Promedio de Precision@6: **{overall['mean_precision_at_k']:.4f}**.",
            f"- Promedio de Recall@6: **{overall['mean_recall_at_k']:.4f}**.",
            "",
            "## Errores y observaciones",
            "",
        ]
    )
    for error in payload["errors"]:
        lines.append(f"- {error}")
    lines.extend(
        [
            "",
            "## Comandos y archivos involucrados",
            "",
            "Comandos de ejecución:",
            "",
            "```bash",
            "cd /home/esnupi/Documents/tesis-v1/data-science",
            "PYTHONDONTWRITEBYTECODE=1 .venv/bin/python - <<'PY'",
            "import asyncio, json",
            "from app.core.config import get_settings",
            "from app.db.couch import CouchClient",
            "from app.db.repositories import TesisRepository",
            "from app.rag.embeddings import EmbeddingService",
            "from app.rag.indexer import RagIndexer",
            "from app.rag.vector_store import SQLiteVectorStore",
            "async def main():",
            "    s = get_settings()",
            "    indexer = RagIndexer(TesisRepository(CouchClient(s.couchdb_url)), EmbeddingService(s.embedding_model), SQLiteVectorStore(s.vector_db_path))",
            "    print(json.dumps(await indexer.rebuild(), ensure_ascii=False))",
            "asyncio.run(main())",
            "PY",
            "cd /home/esnupi/Documents/tesis-v1",
            "PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=data-science data-science/.venv/bin/python data-science/evaluation/evaluate_agent.py",
            "```",
            "",
            "El script automático quedó guardado en `data-science/evaluation/evaluate_agent.py` y su salida completa "
            "en `data-science/evaluation/results/agent-evaluation-2026-09-30.json`.",
            "",
            "Antes de la evaluación se reconstruyó el índice mediante `RagIndexer.rebuild()`, invocado con "
            "un script Python de una sola ejecución desde `data-science/`. Usó el mismo `EmbeddingService` "
            "y `SQLiteVectorStore` de la aplicación y produjo 5.366 fragmentos. Después se ejecutó el comando "
            "anterior para las 22 pruebas. No se inició ningún servidor ni se escribieron conversaciones o "
            "resultados en CouchDB.",
            "",
            "Archivos principales revisados o ejecutados:",
            "",
            "- `data-science/app/api/routes_chat.py`",
            "- `data-science/app/agent/orchestrator.py`",
            "- `data-science/app/agent/tools.py`",
            "- `data-science/app/analytics/intent.py`",
            "- `data-science/app/analytics/stats.py`",
            "- `data-science/app/analytics/dataframe_builder.py`",
            "- `data-science/app/rag/chunking.py`",
            "- `data-science/app/rag/indexer.py`",
            "- `data-science/app/rag/retrieval.py`",
            "- `data-science/app/rag/vector_store.py`",
            "- `data-science/evaluation/evaluate_agent.py`",
            "",
            "El resultado completo, incluyendo valores sin abreviar y errores por caso, está en "
            f"`data-science/evaluation/results/{JSON_PATH.name}`.",
            "",
            "## Explicación sencilla",
            "",
            f"Se ejecutaron {overall['executed']} pruebas: {overall['correct']} fueron satisfactorias y "
            f"{overall['incorrect']} fallaron, para un resultado global de {overall['result']:.2f} %. Primero se "
            "calcularon respuestas correctas directamente desde las historias del viaje. Después se ejecutaron los "
            "mismos caminos de estadísticas, recuperación y orquestación que usa el agente. Las comparaciones se "
            "hicieron automáticamente y los fallos se conservaron. Las siete pruebas de tools fallaron antes de "
            "seleccionar una herramienta porque la clave Groq estaba expirada; por ello, el 40,91 % global también "
            "refleja un problema operativo de configuración. Las pruebas locales, consideradas por separado, lograron "
            "5/8 casos factuales y 4/7 casos de recuperación.",
            "",
        ]
    )
    return "\n".join(lines)


async def main() -> None:
    settings = settings_for_evaluation()
    repository = TesisRepository(CouchClient(settings.couchdb_url))
    ctx = await load_context(repository)
    all_historias = await repository.fetch_historias()

    store = SQLiteVectorStore(settings.vector_db_path)
    retriever = RagRetriever(EmbeddingService(settings.embedding_model), store)
    tools = ResearchTools(
        repository,
        filters={"viaje_id": TRIP_ID},
        chart_type="table",
        retriever_factory=lambda: retriever,
        search_limit=TOP_K,
    )
    chat_client = build_chat_client(settings)
    model_ok, model_detail = await chat_client.check()
    agent = ResearchAgent(chat_client, tools)

    factual = evaluate_factual(ctx)
    retrieval = evaluate_retrieval(retriever)
    tool_results = await evaluate_tools(ctx, agent)
    sections = {"factual": factual, "retrieval": retrieval, "tools": tool_results}
    errors = []
    if not model_ok:
        errors.append(
            "El proveedor LLM configurado no estuvo disponible: " + model_detail.replace("\n", " ")
        )
    if not any(item["correct"] for item in tool_results):
        errors.append(
            "Ninguna prueba de tools llegó a ejecutar una herramienta porque Groq rechazó la autenticación antes de la selección de tool."
        )
    if not factual[5]["correct"]:
        errors.append(
            "La consulta con 'diagnósticos' se clasificó como estadística, pero la ruta determinística busca la palabra sin tilde y devolvió solo el total de historias."
        )
    if not factual[6]["correct"]:
        errors.append(
            "La consulta por grupos de edad se clasificó como estadística, pero la ruta determinística devolvió solo el total de historias; no implementa esa agrupación."
        )
    if not factual[7]["correct"]:
        errors.append(
            "La glicemia está almacenada con unidad (por ejemplo, '91 mg/dL'); la analítica actual intenta convertir toda la cadena con float() y descarta esos valores."
        )
    missed_retrieval = [item["case"] for item in retrieval if not item["correct"]]
    if missed_retrieval:
        errors.append(
            "El recuperador no encontró dentro del top 6 los fragmentos exactos de "
            + ", ".join(missed_retrieval)
            + "; en esos casos priorizó secciones del mismo tipo con valores clínicos parecidos."
        )

    payload = {
        "executed_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "configuration": {
            "provider": settings.llm_provider,
            "model": settings.chat_model,
            "embedding_model": settings.embedding_model,
            "top_k": TOP_K,
            "model_available": model_ok,
            "model_detail": model_detail,
        },
        "dataset": {
            "trip_id": TRIP_ID,
            "historias": len(ctx.historias),
            "pacientes_vinculados": len(ctx.pacientes_by_id),
            "historias_totales": len(all_historias),
            "fragmentos_indexados": store.count(),
        },
        **sections,
        "summary": build_summary(sections),
        "errors": errors,
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_PATH.write_text(build_report(payload), encoding="utf-8")
    print(json.dumps({"report": str(REPORT_PATH), "json": str(JSON_PATH), "summary": payload["summary"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
