import json
from collections import Counter
from dataclasses import dataclass
from statistics import mean, median
from typing import Any, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.analytics.advanced import cluster_rows, numeric_correlations, numeric_outliers
from app.analytics.charts import chart_artifact, count_chart_artifact, table_artifact
from app.analytics.dataframe_builder import build_story_rows
from app.db.repositories import TesisRepository
from app.models.documents import RetrievedChunk
from app.models.responses import Artifact, Source
from app.rag.retrieval import RagRetriever

ChartType = Literal["auto", "table", "bar", "line", "pie", "scatter", "heatmap"]
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


class NumericDistributionArguments(ToolArguments):
    field: NumericField
    chart_type: ChartType = Field(default="auto", alias="chartType")


class CompareNumericByGroupArguments(ToolArguments):
    field: NumericField
    group: GroupField


class SearchContextArguments(ToolArguments):
    query: str = Field(min_length=2, max_length=500)
    limit: int = Field(default=6, ge=1, le=10)


class SampleHistoriesArguments(ToolArguments):
    limit: int = Field(default=5, ge=1, le=10)


class ClusterHistoriesArguments(ToolArguments):
    fields: list[NumericField] = Field(min_length=2, max_length=4)
    clusters: int = Field(default=3, ge=2, le=6)


class DetectNumericOutliersArguments(ToolArguments):
    field: NumericField
    method: Literal["iqr", "zscore"] = "iqr"


class CorrelateNumericFieldsArguments(ToolArguments):
    fields: list[NumericField] = Field(min_length=2, max_length=4)


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
        search_limit: int = 6,
    ) -> None:
        self.repository = repository
        self.filters = filters
        self.chart_type = chart_type
        self.retriever_factory = retriever_factory
        self.search_limit = search_limit
        self._rows: list[dict[str, Any]] | None = None
        self._retriever: RagRetriever | None = None

    @staticmethod
    def definitions() -> list[dict[str, Any]]:
        return [
            tool_definition(
                "count_histories",
                "Cuenta historias clinicas. Usala solo cuando el usuario pida un total simple, no graficos ni analisis.",
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
                "numeric_distribution",
                (
                    "Genera una distribucion/frecuencia por rangos de un indicador numerico. "
                    "Usala cuando el usuario pida grafico, histograma, frecuencia o distribucion "
                    "de IMC, glicemia, frecuencia cardiaca o presion arterial media."
                ),
                NumericDistributionArguments,
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
                "compare_numeric_by_group",
                (
                    "Compara un indicador numerico por genero, viaje, grupo de edad, "
                    "clasificacion de IMC o diagnostico. Usala para analisis multivariable "
                    "o preguntas tipo 'IMC por genero'."
                ),
                CompareNumericByGroupArguments,
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
            tool_definition(
                "cluster_histories",
                "Agrupa historias por 2 a 4 indicadores numericos con KMeans estandarizado. Devuelve tamanos y perfiles de grupos; no infiere diagnosticos.",
                ClusterHistoriesArguments,
            ),
            tool_definition(
                "detect_numeric_outliers",
                "Detecta valores atipicos de un indicador numerico mediante IQR (1.5 veces el rango intercuartil) o puntuacion Z (umbral 3).",
                DetectNumericOutliersArguments,
            ),
            tool_definition(
                "correlate_numeric_fields",
                "Calcula correlaciones de Pearson entre 2 a 4 indicadores numericos usando pares con datos validos.",
                CorrelateNumericFieldsArguments,
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
        if name == "numeric_distribution":
            parsed = NumericDistributionArguments.model_validate(arguments)
            return await self._numeric_distribution(parsed)
        if name == "cross_tab_histories":
            parsed = CrossTabHistoriesArguments.model_validate(arguments)
            return await self._cross_tab_histories(parsed)
        if name == "compare_numeric_by_group":
            parsed = CompareNumericByGroupArguments.model_validate(arguments)
            return await self._compare_numeric_by_group(parsed)
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
        if name == "cluster_histories":
            parsed = ClusterHistoriesArguments.model_validate(arguments)
            return await self._cluster_histories(parsed)
        if name == "detect_numeric_outliers":
            parsed = DetectNumericOutliersArguments.model_validate(arguments)
            return await self._detect_numeric_outliers(parsed)
        if name == "correlate_numeric_fields":
            parsed = CorrelateNumericFieldsArguments.model_validate(arguments)
            return await self._correlate_numeric_fields(parsed)
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

    async def _numeric_distribution(
        self,
        arguments: NumericDistributionArguments,
    ) -> ToolExecution:
        rows = await self._get_rows()
        values = numeric_values(rows, arguments.field)
        label = NUMERIC_LABELS[arguments.field]
        bins = numeric_frequency_rows(values)
        chart_type = self._resolve_chart_type(arguments.chart_type)
        if chart_type in {"pie", "scatter", "heatmap"}:
            chart_type = "bar"
        summary = numeric_summary(values, label)
        return tool_result(
            {
                "indicador": label,
                "historiasAnalizadas": len(rows),
                "valoresDisponibles": len(values),
                "resumen": summary,
                "rangos": bins,
            },
            artifacts=[
                chart_artifact(
                    f"Frecuencia de {label}",
                    "rango",
                    "historias",
                    bins,
                    description=f"Frecuencia de valores de {label} agrupados por rangos.",
                    kind=chart_type,
                    role="primary",
                ),
                table_artifact(
                    f"Resumen de {label}",
                    [summary],
                    description="Resumen numerico de los valores disponibles.",
                    role="summary",
                ),
            ],
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
            artifacts=[
                table_artifact(
                    title,
                    table_rows,
                    description="Cruce categorico calculado dentro del alcance autorizado.",
                    role="breakdown",
                )
            ],
        )

    async def _compare_numeric_by_group(
        self,
        arguments: CompareNumericByGroupArguments,
    ) -> ToolExecution:
        rows = await self._get_rows()
        grouped_rows = numeric_by_group_rows(rows, arguments.field, arguments.group)
        label = NUMERIC_LABELS[arguments.field]
        _, group_key = GROUP_LABELS[arguments.group]
        values = numeric_values(rows, arguments.field)
        artifacts: list[Artifact] = []
        if grouped_rows:
            artifacts.extend(
                [
                    chart_artifact(
                        f"{label} promedio por {group_key}",
                        group_key,
                        "promedio",
                        grouped_rows,
                        description=f"Comparacion multivariable de {label} agrupada por {group_key}.",
                        kind="bar",
                        role="primary",
                    ),
                    table_artifact(
                        f"Resumen de {label} por {group_key}",
                        grouped_rows,
                        description="Promedio, mediana y rango por grupo.",
                        role="breakdown",
                    ),
                ]
            )
        if values:
            artifacts.append(
                table_artifact(
                    f"Resumen general de {label}",
                    [numeric_summary(values, label)],
                    description="Resumen calculado sobre todos los valores disponibles.",
                    role="summary",
                )
            )

        return tool_result(
            {
                "indicador": label,
                "agrupacion": arguments.group,
                "historiasAnalizadas": len(rows),
                "valoresDisponibles": len(values),
                "grupos": grouped_rows,
            },
            artifacts=artifacts,
        )

    async def _summarize_numeric_field(
        self,
        arguments: SummarizeNumericArguments,
    ) -> ToolExecution:
        rows = await self._get_rows()
        values = numeric_values(rows, arguments.field)
        label = NUMERIC_LABELS[arguments.field]
        summary = numeric_summary(values, label)
        return tool_result(
            summary,
            artifacts=[
                table_artifact(
                    f"Resumen de {label}",
                    [summary],
                    description="Resumen numerico de los valores disponibles.",
                    role="summary",
                )
            ],
        )

    def _search_clinical_context(
        self,
        arguments: SearchContextArguments,
    ) -> ToolExecution:
        contexts = self._get_retriever().search(
            arguments.query,
            filters=self.filters,
            limit=min(arguments.limit, self.search_limit),
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

    async def _cluster_histories(self, arguments: ClusterHistoriesArguments) -> ToolExecution:
        result = cluster_rows(await self._get_rows(), arguments.fields, arguments.clusters)
        groups = result["clusters"]
        if not groups:
            return tool_result(result)
        return tool_result(
            result,
            artifacts=[
                chart_artifact(
                    "Historias por grupo clinico", "grupo", "historias", groups,
                    kind="bar", role="primary",
                    description="Grupos exploratorios calculados con KMeans sobre indicadores estandarizados.",
                ),
                table_artifact(
                    "Perfil numerico por grupo", groups, role="summary",
                    description="Medias originales por grupo; se excluyen historias con indicadores faltantes.",
                ),
            ],
        )

    async def _detect_numeric_outliers(self, arguments: DetectNumericOutliersArguments) -> ToolExecution:
        result = numeric_outliers(await self._get_rows(), arguments.field, arguments.method)
        if result["limiteInferior"] is None:
            return tool_result(result)
        return tool_result(
            result,
            artifacts=[
                chart_artifact(
                    f"Valores atipicos de {NUMERIC_LABELS[arguments.field]}",
                    "categoria", "historias",
                    [
                        {"categoria": "Dentro de limites", "historias": result["valoresValidos"] - result["atipicos"]},
                        {"categoria": "Atipicos", "historias": result["atipicos"]},
                    ],
                    kind="bar", role="primary",
                    description=f"Deteccion estadistica por {arguments.method.upper()}, no diagnostico clinico.",
                ),
                table_artifact(
                    "Resumen de valores atipicos",
                    [{key: value for key, value in result.items() if key != "valoresAtipicos"}],
                    role="summary",
                ),
            ],
        )

    async def _correlate_numeric_fields(self, arguments: CorrelateNumericFieldsArguments) -> ToolExecution:
        result = numeric_correlations(await self._get_rows(), arguments.fields)
        pairs = result["correlaciones"]
        valid = [pair for pair in pairs if pair["correlacion"] is not None]
        artifacts = [table_artifact(
            "Correlaciones de Pearson", pairs, role="summary",
            description="Cada par utiliza historias con ambos indicadores validos.",
        )]
        if valid:
            artifacts.insert(0, chart_artifact(
                "Magnitud de correlaciones", "par", "magnitud",
                [
                    {
                        "par": f"{pair['indicadorA']} / {pair['indicadorB']}",
                        "magnitud": abs(pair["correlacion"]),
                    }
                    for pair in valid
                ],
                kind="bar", role="primary",
                description="Magnitud absoluta; consulta el signo y el numero de pares en la tabla.",
            ))
        return tool_result(result, artifacts=artifacts)

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


def numeric_summary(values: list[float], label: str) -> dict[str, Any]:
    summary = {
        "indicador": label,
        "registros": len(values),
        "promedio": round(mean(values), 2) if values else None,
        "mediana": round(median(values), 2) if values else None,
        "minimo": round(min(values), 2) if values else None,
        "maximo": round(max(values), 2) if values else None,
    }
    return summary


def numeric_frequency_rows(values: list[float], bins_count: int = 8) -> list[dict[str, Any]]:
    if not values:
        return []

    low = min(values)
    high = max(values)
    if low == high:
        return [{"rango": format_range_label(low, high), "historias": len(values)}]

    width = (high - low) / bins_count
    bins = [0 for _ in range(bins_count)]
    for value in values:
        index = int((value - low) / width)
        if index >= bins_count:
            index = bins_count - 1
        bins[index] += 1

    result = []
    for index, count in enumerate(bins):
        start = low + width * index
        end = high if index == bins_count - 1 else low + width * (index + 1)
        result.append({"rango": format_range_label(start, end), "historias": count})
    return result


def format_range_label(start: float, end: float) -> str:
    if start == end:
        return format_number(start)
    return f"{format_number(start)}-{format_number(end)}"


def format_number(value: float) -> str:
    rounded = round(value, 1)
    if rounded.is_integer():
        return str(int(rounded))
    return str(rounded)


def numeric_by_group_rows(
    rows: list[dict[str, Any]],
    numeric_field: NumericField,
    group_field: GroupField,
) -> list[dict[str, Any]]:
    _, group_key = GROUP_LABELS[group_field]
    grouped: dict[str, list[float]] = {}
    for row in rows:
        value = row.get(numeric_field)
        if value is None or value == "":
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue

        for group in row_values(row, group_field):
            grouped.setdefault(group, []).append(number)

    result = []
    for group, values in grouped.items():
        result.append(
            {
                group_key: group,
                "registros": len(values),
                "promedio": round(mean(values), 2),
                "mediana": round(median(values), 2),
                "minimo": round(min(values), 2),
                "maximo": round(max(values), 2),
            }
        )
    return sorted(result, key=lambda row: row["registros"], reverse=True)


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
