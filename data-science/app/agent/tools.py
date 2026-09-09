import json
from collections import Counter
from dataclasses import dataclass
from statistics import mean
from typing import Any, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.analytics.charts import count_chart_artifact, table_artifact
from app.analytics.dataframe_builder import build_story_rows
from app.db.repositories import TesisRepository
from app.models.documents import RetrievedChunk
from app.models.responses import Artifact, Source
from app.rag.retrieval import RagRetriever

ChartType = Literal["auto", "table", "bar", "line", "pie"]
GroupField = Literal["genero", "diagnosticos", "diagnosticoIMC", "viajeId", "grupoEdad"]
NumericField = Literal[
    "imc",
    "frecuenciaCardiaca",
    "presionArterialMedia",
    "glicemiaCapilar",
]

GROUP_LABELS: dict[GroupField, tuple[str, str]] = {
    "genero": ("Distribucion por genero", "genero"),
    "diagnosticos": ("Todos los diagnosticos registrados", "diagnostico"),
    "diagnosticoIMC": ("Clasificacion de IMC", "clasificacion"),
    "viajeId": ("Historias por viaje", "viaje"),
    "grupoEdad": ("Distribucion por grupo de edad", "grupoEdad"),
}

NUMERIC_LABELS: dict[NumericField, str] = {
    "imc": "IMC",
    "frecuenciaCardiaca": "Frecuencia cardiaca",
    "presionArterialMedia": "Presion arterial media",
    "glicemiaCapilar": "Glicemia capilar",
}


class ToolArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmptyArguments(ToolArguments):
    pass


class GroupHistoriesArguments(ToolArguments):
    field: GroupField
    chart_type: ChartType = Field(default="auto", alias="chartType")


class CrossTabHistoriesArguments(ToolArguments):
    primary: GroupField
    secondary: GroupField
    limit: int = Field(default=12, ge=1, le=30)


class SummarizeNumericArguments(ToolArguments):
    field: NumericField


class SearchContextArguments(ToolArguments):
    query: str = Field(min_length=2, max_length=500)
    limit: int = Field(default=6, ge=1, le=10)


class SampleHistoriesArguments(ToolArguments):
    limit: int = Field(default=5, ge=1, le=10)


@dataclass(frozen=True)
class ToolExecution:
    content: str
    artifacts: list[Artifact]
    sources: list[Source]


class ResearchTools:
    def __init__(
        self,
        repository: TesisRepository,
        *,
        filters: dict[str, Any],
        chart_type: ChartType,
        retriever_factory: Callable[[], RagRetriever],
    ) -> None:
        self.repository = repository
        self.filters = filters
        self.chart_type = chart_type
        self.retriever_factory = retriever_factory
        self._rows: list[dict[str, Any]] | None = None
        self._retriever: RagRetriever | None = None

    @staticmethod
    def definitions() -> list[dict[str, Any]]:
        return [
            tool_definition(
                "count_histories",
                "Cuenta las historias clinicas dentro del alcance autorizado.",
                EmptyArguments,
            ),
            tool_definition(
                "group_histories_by",
                (
                    "Agrupa historias por genero, diagnosticos, clasificacion de IMC, "
                    "grupo de edad o viaje y prepara una tabla o grafica."
                ),
                GroupHistoriesArguments,
            ),
            tool_definition(
                "cross_tab_histories",
                (
                    "Cruza dos agrupaciones autorizadas. Usala para ampliar una consulta "
                    "principal con distribucion por viaje, genero o grupo de edad."
                ),
                CrossTabHistoriesArguments,
            ),
            tool_definition(
                "summarize_numeric_field",
                (
                    "Calcula cantidad de registros, promedio, minimo y maximo de "
                    "un indicador clinico permitido."
                ),
                SummarizeNumericArguments,
            ),
            tool_definition(
                "search_clinical_context",
                (
                    "Busca evidencia narrativa relevante en el indice clinico local. "
                    "Usala para resumenes o preguntas que necesiten contexto textual "
                    "sobre las historias clinicas, sintomas, hallazgos o narrativas de atencion."
                ),
                SearchContextArguments,
            ),
            tool_definition(
                "sample_histories",
                (
                    "Muestra un resumen de historias clinicas de ejemplo con sus datos "
                    "principales (diagnosticos, indicadores, genero, edad, viaje). "
                    "Usala para entender el contenido y contexto de las historias "
                    "antes de responder preguntas interpretativas."
                ),
                SampleHistoriesArguments,
            ),
            tool_definition(
                "list_available_fields",
                "Lista los campos autorizados para analisis.",
                EmptyArguments,
            ),
        ]

    async def execute(self, name: str, raw_arguments: Any) -> ToolExecution:
        arguments = normalize_arguments(raw_arguments)
        if name == "count_histories":
            EmptyArguments.model_validate(arguments)
            return await self._count_histories()
        if name == "group_histories_by":
            parsed = GroupHistoriesArguments.model_validate(arguments)
            return await self._group_histories_by(parsed)
        if name == "cross_tab_histories":
            parsed = CrossTabHistoriesArguments.model_validate(arguments)
            return await self._cross_tab_histories(parsed)
        if name == "summarize_numeric_field":
            parsed = SummarizeNumericArguments.model_validate(arguments)
            return await self._summarize_numeric_field(parsed)
        if name == "search_clinical_context":
            parsed = SearchContextArguments.model_validate(arguments)
            return self._search_clinical_context(parsed)
        if name == "sample_histories":
            parsed = SampleHistoriesArguments.model_validate(arguments)
            return await self._sample_histories(parsed)
        if name == "list_available_fields":
            EmptyArguments.model_validate(arguments)
            return self._list_available_fields()
        raise ValueError(f"Herramienta no permitida: {name}")

    async def _count_histories(self) -> ToolExecution:
        rows = await self._get_rows()
        artifact = table_artifact("Conteo de historias", [{"historias": len(rows)}])
        return tool_result(
            {
                "historias": len(rows),
                "nota": "Conteo calculado dentro del alcance autorizado.",
            },
            artifacts=[artifact],
        )

    async def _group_histories_by(
        self,
        arguments: GroupHistoriesArguments,
    ) -> ToolExecution:
        rows = await self._get_rows()
        counts = Counter[str]()
        for row in rows:
            value = row.get(arguments.field)
            if arguments.field == "diagnosticos":
                diagnoses = value or ["Sin diagnostico"]
                counts.update(str(item) for item in diagnoses)
            else:
                counts[str(value or "Sin dato")] += 1

        title, label_key = GROUP_LABELS[arguments.field]
        chart_type = self._resolve_chart_type(arguments.chart_type)
        artifacts: list[Artifact]
        if chart_type == "table":
            artifact = table_artifact(
                title,
                [
                    {label_key: label, "historias": value}
                    for label, value in counts.most_common()
                ],
                label_key=label_key,
                value_key="historias",
            )
        else:
            artifact = count_chart_artifact(
                title,
                label_key,
                "historias",
                counts,
                kind=chart_type,
            )
        artifacts = [artifact]

        if arguments.field == "diagnosticos":
            artifacts.extend(
                [
                    cross_tab_artifact(rows, "diagnosticos", "genero"),
                    cross_tab_artifact(rows, "diagnosticos", "grupoEdad"),
                ]
            )
        elif arguments.field == "genero":
            artifacts.append(cross_tab_artifact(rows, "genero", "viajeId"))

        return tool_result(
            {
                "campo": arguments.field,
                "historiasAnalizadas": len(rows),
                "grupos": dict(counts.most_common()),
                "crucesComplementarios": [
                    artifact.title for artifact in artifacts[1:]
                ],
            },
            artifacts=artifacts,
        )

    async def _cross_tab_histories(
        self,
        arguments: CrossTabHistoriesArguments,
    ) -> ToolExecution:
        rows = await self._get_rows()
        counts = Counter[tuple[str, str]]()
        primary_totals = Counter[str]()
        for row in rows:
            primary_values = row_values(row, arguments.primary)
            secondary_values = row_values(row, arguments.secondary)
            for primary in primary_values:
                primary_totals[primary] += 1
                for secondary in secondary_values:
                    counts[(primary, secondary)] += 1

        _, primary_key = GROUP_LABELS[arguments.primary]
        _, secondary_key = GROUP_LABELS[arguments.secondary]
        limited_primary = {
            label for label, _ in primary_totals.most_common(arguments.limit)
        }
        table_rows = [
            {
                primary_key: primary,
                secondary_key: secondary,
                "historias": value,
            }
            for (primary, secondary), value in counts.most_common()
            if primary in limited_primary
        ]
        title = f"{GROUP_LABELS[arguments.primary][0]} por {secondary_key}"

        return tool_result(
            {
                "campoPrincipal": arguments.primary,
                "campoSecundario": arguments.secondary,
                "historiasAnalizadas": len(rows),
                "filas": table_rows,
                "nota": "Tabla cruzada calculada dentro del alcance autorizado.",
            },
            artifacts=[table_artifact(title, table_rows)],
        )

    async def _summarize_numeric_field(
        self,
        arguments: SummarizeNumericArguments,
    ) -> ToolExecution:
        rows = await self._get_rows()
        values = numeric_values(rows, arguments.field)
        label = NUMERIC_LABELS[arguments.field]
        summary = {
            "indicador": label,
            "registros": len(values),
            "promedio": round(mean(values), 2) if values else None,
            "minimo": round(min(values), 2) if values else None,
            "maximo": round(max(values), 2) if values else None,
        }
        return tool_result(summary, artifacts=[table_artifact(f"Resumen de {label}", [summary])])

    def _search_clinical_context(
        self,
        arguments: SearchContextArguments,
    ) -> ToolExecution:
        contexts = self._get_retriever().search(
            arguments.query,
            filters=self.filters,
            limit=arguments.limit,
        )
        return tool_result(
            {
                "resultados": [
                    {
                        "fuente": context.title,
                        "contenido": context.text,
                        "puntaje": round(context.score, 4),
                    }
                    for context in contexts
                ],
                "nota": (
                    "Usa exclusivamente estos fragmentos para responder. "
                    "Indica si no alcanzan para sostener una conclusion."
                ),
            },
            sources=[context.to_source() for context in contexts],
        )

    async def _sample_histories(
        self,
        arguments: SampleHistoriesArguments,
    ) -> ToolExecution:
        rows = await self._get_rows()
        sample = rows[: arguments.limit]
        summaries = []
        for row in sample:
            summary: dict[str, Any] = {}
            if row.get("genero"):
                summary["genero"] = row["genero"]
            if row.get("grupoEdad"):
                summary["grupoEdad"] = row["grupoEdad"]
            if row.get("viajeId"):
                summary["viaje"] = row["viajeId"]
            if row.get("diagnosticos"):
                summary["diagnosticos"] = row["diagnosticos"]
            if row.get("diagnosticoIMC"):
                summary["clasificacionIMC"] = row["diagnosticoIMC"]
            for numeric_field in NUMERIC_LABELS:
                value = row.get(numeric_field)
                if value is not None and value != "":
                    summary[numeric_field] = value
            summaries.append(summary)

        return tool_result(
            {
                "totalHistorias": len(rows),
                "muestraDeHistorias": summaries,
                "nota": (
                    "Esta es una muestra representativa de las historias disponibles. "
                    "Usa esta informacion para entender el contexto de los datos "
                    "antes de responder la pregunta del usuario."
                ),
            },
        )

    def _list_available_fields(self) -> ToolExecution:
        return tool_result(
            {
                "camposDisponiblesEnElSistema": {
                    "delPaciente": [
                        "genero (Masculino, Femenino, Indeterminado)",
                        "fechaNacimiento",
                        "edad (calculada)",
                        "grupoEdad (0-4, 5-11, 12-17, 18-29, 30-44, 45-59, 60+)",
                        "nacionalidad",
                        "etnia (opcional)",
                    ],
                    "delaHistoriaClinica": [
                        "viajeId (campana/viaje en que se registro)",
                        "diagnosticoPrincipal",
                        "diagnosticos (lista completa incluyendo secundarios)",
                        "imc",
                        "diagnosticoIMC (clasificacion)",
                        "frecuenciaCardiaca",
                        "presionArterialMedia",
                        "glicemiaCapilar",
                    ],
                },
                "camposQueNOexistenEnElSistema": [
                    "estado civil",
                    "ocupacion",
                    "escolaridad",
                    "ingreso economico",
                    "religion",
                    "direccion",
                    "telefono",
                ],
                "agrupaciones": list(GROUP_LABELS),
                "indicadoresNumericos": list(NUMERIC_LABELS),
                "crucesSugeridos": [
                    "genero por viajeId",
                    "diagnosticos por genero",
                    "diagnosticos por grupoEdad",
                    "diagnosticos por viajeId",
                ],
                "nota": (
                    "Si el usuario pregunta por un dato que NO existe en el sistema, "
                    "respondele que ese dato no se recolecta actualmente. "
                    "Los filtros de viajes y estacion los impone el backend."
                ),
            }
        )

    async def _get_rows(self) -> list[dict[str, Any]]:
        if self._rows is None:
            historias = await self.repository.fetch_historias(**self.filters)
            pacientes = await self.repository.fetch_pacientes_for_historias(historias)
            self._rows = build_story_rows(historias, pacientes)
        return self._rows

    def _get_retriever(self) -> RagRetriever:
        if self._retriever is None:
            self._retriever = self.retriever_factory()
        return self._retriever

    def _resolve_chart_type(self, tool_chart_type: ChartType) -> str:
        requested = self.chart_type if self.chart_type != "auto" else tool_chart_type
        return "bar" if requested == "auto" else requested


def tool_definition(
    name: str,
    description: str,
    arguments_model: type[BaseModel],
) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": arguments_model.model_json_schema(),
        },
    }


def normalize_arguments(raw_arguments: Any) -> dict[str, Any]:
    if raw_arguments is None:
        return {}
    if isinstance(raw_arguments, dict):
        return raw_arguments
    if isinstance(raw_arguments, str):
        parsed = json.loads(raw_arguments or "{}")
        if parsed is None:
            return {}
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("Los argumentos de la herramienta deben ser un objeto JSON.")


def numeric_values(rows: list[dict[str, Any]], field: NumericField) -> list[float]:
    values: list[float] = []
    for row in rows:
        try:
            value = row.get(field)
            if value is not None and value != "":
                values.append(float(value))
        except (TypeError, ValueError):
            continue
    return values


def row_values(row: dict[str, Any], field: GroupField) -> list[str]:
    value = row.get(field)
    if field == "diagnosticos":
        diagnoses = value or ["Sin diagnostico"]
        return [str(item) for item in diagnoses if item] or ["Sin diagnostico"]
    return [str(value or "Sin dato")]


def cross_tab_artifact(
    rows: list[dict[str, Any]],
    primary_field: GroupField,
    secondary_field: GroupField,
) -> Artifact:
    counts = Counter[tuple[str, str]]()
    for row in rows:
        for primary in row_values(row, primary_field):
            for secondary in row_values(row, secondary_field):
                counts[(primary, secondary)] += 1

    _, primary_key = GROUP_LABELS[primary_field]
    _, secondary_key = GROUP_LABELS[secondary_field]
    return table_artifact(
        f"{GROUP_LABELS[primary_field][0]} por {secondary_key}",
        [
            {
                primary_key: primary,
                secondary_key: secondary,
                "historias": value,
            }
            for (primary, secondary), value in counts.most_common()
        ],
    )


def tool_result(
    payload: dict[str, Any],
    *,
    artifacts: list[Artifact] | None = None,
    sources: list[Source] | None = None,
) -> ToolExecution:
    return ToolExecution(
        content=json.dumps(payload, ensure_ascii=False),
        artifacts=artifacts or [],
        sources=sources or [],
    )
