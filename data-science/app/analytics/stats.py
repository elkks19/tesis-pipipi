from collections import Counter
from dataclasses import dataclass
from statistics import mean, median
from typing import Any

from app.analytics.charts import chart_artifact, count_chart_artifact, table_artifact
from app.models.responses import Artifact

NUMERIC_FIELD_PATTERNS = [
    (
        "imc",
        "IMC",
        ["imc", "indice de masa corporal", "índice de masa corporal"],
    ),
    (
        "frecuenciaCardiaca",
        "frecuencia cardiaca",
        ["frecuencia cardiaca", "frecuencia cardíaca", "fc"],
    ),
    (
        "presionArterialMedia",
        "presion arterial media",
        ["presion arterial media", "presión arterial media", "pam"],
    ),
    (
        "glicemiaCapilar",
        "glicemia capilar",
        ["glicemia", "glucemia", "azucar", "azúcar"],
    ),
]

GROUP_FIELD_PATTERNS = [
    ("genero", "genero", ["genero", "género", "sexo"]),
    ("grupoEdad", "grupoEdad", ["grupo de edad", "edad", "etario", "etaria"]),
    ("viajeId", "viaje", ["viaje", "campana", "campaña"]),
    ("diagnosticoIMC", "clasificacion", ["clasificacion imc", "clasificación imc", "diagnostico imc"]),
    ("diagnosticos", "diagnostico", ["diagnostico", "diagnóstico", "patologia", "patología", "enfermedad"]),
]


@dataclass(frozen=True)
class AnalyticsAnswer:
    answer: str
    artifacts: list[Artifact]


def answer_with_statistics(
    message: str,
    rows: list[dict[str, Any]],
    intent: str,
    chart_type: str = "auto",
) -> AnalyticsAnswer:
    text = message.lower()
    total = len(rows)

    if not rows:
        return AnalyticsAnswer("No encontre historias dentro del alcance indicado.", [])

    if (
        ("genero" in text or "género" in text)
        and not detect_numeric_field(text)
        and not any(word in text for word in ["diagnost", "enfermedad", "patologia", "patología"])
    ):
        counts = Counter(str(row.get("genero") or "Sin dato") for row in rows)
        artifact = artifact_for_counts(
            "Distribucion por genero",
            "genero",
            "historias",
            counts,
            chart_type,
            text,
        )
        by_trip = cross_table_rows(rows, "genero", "viajeId", "genero", "viaje")
        artifacts = [artifact]
        if by_trip:
            artifacts.append(table_artifact("Distribucion por genero y viaje", by_trip))
        return AnalyticsAnswer(
            (
                f"Encontre {total} historias. La distribucion por genero esta en la grafica "
                "y agregue el cruce por viaje cuando hay datos disponibles."
            ),
            artifacts,
        )

    numeric_field = detect_numeric_field(text)
    if numeric_field:
        field, label = numeric_field
        values = [float(row[field]) for row in rows if is_number(row.get(field))]
        if not values:
            return AnalyticsAnswer(
                f"No encontre valores de {label} en las historias filtradas.",
                [],
            )
        group_field = detect_group_field(text)
        if group_field and wants_multivariable(text):
            grouped_rows = numeric_by_group_rows(rows, field, group_field[0], group_field[1])
            summary = numeric_summary(values)
            if grouped_rows:
                return AnalyticsAnswer(
                    (
                        f"Encontre {len(values)} valores de {label}. "
                        f"Compare el indicador por {group_field[1]} y agregue el resumen general "
                        "para revisar la distribucion sin enviar el dataset completo al LLM."
                    ),
                    [
                        chart_artifact(
                            f"{label} promedio por {group_field[1]}",
                            group_field[1],
                            "promedio",
                            grouped_rows,
                            description=f"Comparacion multivariable de {label} agrupada por {group_field[1]}.",
                            kind="bar",
                            role="primary",
                        ),
                        table_artifact(
                            f"Resumen de {label} por {group_field[1]}",
                            grouped_rows,
                            description="Promedio, mediana y rango por grupo.",
                            role="breakdown",
                        ),
                        table_artifact(
                            f"Resumen general de {label}",
                            [summary],
                            description="Resumen calculado sobre todos los valores disponibles.",
                            role="summary",
                        ),
                    ],
                )
        if wants_numeric_distribution(text, intent):
            bins = numeric_frequency_rows(values)
            distribution_kind = normalize_chart_type(chart_type, text)
            if distribution_kind in {"pie", "scatter", "heatmap"}:
                distribution_kind = "bar"
            artifact = chart_artifact(
                f"Frecuencia de {label}",
                "rango",
                "historias",
                bins,
                description=f"Frecuencia de valores de {label} agrupados por rangos.",
                kind=distribution_kind,
                role="primary",
            )
            summary = numeric_summary(values)
            return AnalyticsAnswer(
                (
                    f"Encontre {len(values)} valores de {label}. "
                    f"La frecuencia por rangos esta en la grafica; "
                    f"promedio {summary['promedio']}, minimo {summary['minimo']} "
                    f"y maximo {summary['maximo']}."
                ),
                [
                    artifact,
                    table_artifact(
                        f"Resumen de {label}",
                        [summary],
                        description="Resumen numerico de los valores disponibles.",
                        role="summary",
                    ),
                ],
            )
        summary_rows = [
            numeric_summary(values, label),
        ]
        artifact = table_artifact(
            f"Resumen de {label}",
            summary_rows,
            description="Resumen numerico de los valores disponibles.",
            role="summary",
        )
        return AnalyticsAnswer(
            (
                f"El promedio de {label} es {round(mean(values), 2)} "
                f"sobre {len(values)} historias con dato disponible."
            ),
            [artifact],
        )

    if any(word in text for word in ["diagnost", "enfermedad", "patologia", "patología"]):
        counts = Counter(
            diagnosis
            for row in rows
            for diagnosis in (row.get("diagnosticos") or ["Sin diagnostico"])
        )
        artifact = artifact_for_counts(
            "Todos los diagnosticos registrados",
            "diagnostico",
            "historias",
            counts,
            chart_type,
            text,
        )
        by_gender = diagnosis_cross_table_rows(rows, "genero", "genero")
        by_age = diagnosis_cross_table_rows(rows, "grupoEdad", "grupoEdad")
        by_age_gender = cross_table_rows(rows, "grupoEdad", "genero", "grupoEdad", "genero")
        artifacts = [artifact]
        if by_gender:
            artifacts.append(
                table_artifact(
                    "Diagnosticos por genero",
                    by_gender,
                    description="Cruce de diagnosticos registrados por genero.",
                    role="breakdown",
                )
            )
        if by_age:
            artifacts.append(
                table_artifact(
                    "Diagnosticos por grupo de edad",
                    by_age,
                    description="Cruce de diagnosticos registrados por grupo etario.",
                    role="breakdown",
                )
            )
        if wants_multivariable(text) and by_age_gender:
            artifacts.append(
                chart_artifact(
                    "Historias por grupo de edad y genero",
                    "grupoEdad",
                    "historias",
                    by_age_gender,
                    description="Mapa de calor para revisar volumen de historias por edad y genero.",
                    group="genero",
                    kind="heatmap",
                    role="breakdown",
                )
            )
        return AnalyticsAnswer(
            (
                f"Encontre {total} historias. Los diagnosticos mas frecuentes estan en el "
                "resultado, con cruces por genero y grupo de edad si hay datos disponibles."
            ),
            artifacts,
        )

    return AnalyticsAnswer(
        f"Encontre {total} historias dentro del alcance indicado.",
        [table_artifact("Conteo de historias", [{"historias": total}])],
    )


def is_number(value: Any) -> bool:
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def detect_numeric_field(text: str) -> tuple[str, str] | None:
    for field, label, patterns in NUMERIC_FIELD_PATTERNS:
        if any(pattern in text for pattern in patterns):
            return field, label

    return None


def detect_group_field(text: str) -> tuple[str, str] | None:
    for field, label, patterns in GROUP_FIELD_PATTERNS:
        if any(pattern in text for pattern in patterns):
            return field, label

    return None


def wants_multivariable(text: str) -> bool:
    return any(
        phrase in text
        for phrase in [
            " por ",
            "segun",
            "según",
            "compara",
            "comparar",
            "comparacion",
            "comparación",
            "cruza",
            "cruce",
            "relacion",
            "relación",
            "multivariable",
        ]
    )


def wants_numeric_distribution(text: str, intent: str) -> bool:
    if intent == "chart":
        return True

    return any(
        phrase in text
        for phrase in [
            "distribucion",
            "distribución",
            "frecuencia de",
            "frecuencias de",
            "histograma",
            "rangos",
            "valores",
        ]
    )


def numeric_summary(values: list[float], label: str | None = None) -> dict[str, Any]:
    row = {
        "registros": len(values),
        "promedio": round(mean(values), 2),
        "mediana": round(median(values), 2),
        "minimo": round(min(values), 2),
        "maximo": round(max(values), 2),
    }
    if label:
        return {"indicador": label, **row}
    return row


def numeric_frequency_rows(values: list[float], bins_count: int = 8) -> list[dict[str, Any]]:
    low = min(values)
    high = max(values)

    if low == high:
        label = format_range_label(low, high)
        return [{"rango": label, "historias": len(values)}]

    width = (high - low) / bins_count
    bins = [0 for _ in range(bins_count)]

    for value in values:
        index = int((value - low) / width)
        if index >= bins_count:
            index = bins_count - 1
        bins[index] += 1

    rows = []
    for index, count in enumerate(bins):
        start = low + width * index
        end = high if index == bins_count - 1 else low + width * (index + 1)
        rows.append(
            {
                "rango": format_range_label(start, end),
                "historias": count,
            }
        )
    return rows


def format_range_label(start: float, end: float) -> str:
    if start == end:
        return format_number(start)
    return f"{format_number(start)}-{format_number(end)}"


def format_number(value: float) -> str:
    rounded = round(value, 1)
    if rounded.is_integer():
        return str(int(rounded))
    return str(rounded)


def artifact_for_counts(
    title: str,
    label_key: str,
    value_key: str,
    counts: Counter[str],
    chart_type: str,
    text: str,
) -> Artifact:
    if chart_type == "table":
        return table_artifact(
            title,
            [{label_key: key, value_key: value} for key, value in counts.most_common()],
            label_key=label_key,
            role="primary",
            value_key=value_key,
        )

    kind = normalize_chart_type(chart_type, text)
    return count_chart_artifact(title, label_key, value_key, counts, kind=kind, role="primary")


def normalize_chart_type(chart_type: str, text: str) -> str:
    if chart_type in {"bar", "line", "pie", "scatter", "heatmap"}:
        return chart_type

    if any(word in text for word in ["linea", "línea", "lineas", "líneas"]):
        return "line"
    if any(word in text for word in ["pie", "torta", "pastel"]):
        return "pie"

    return "bar"


def cross_table_rows(
    rows: list[dict[str, Any]],
    primary_field: str,
    secondary_field: str,
    primary_key: str,
    secondary_key: str,
) -> list[dict[str, Any]]:
    counts = Counter(
        (
            str(row.get(primary_field) or "Sin dato"),
            str(row.get(secondary_field) or "Sin dato"),
        )
        for row in rows
    )
    return [
        {primary_key: primary, secondary_key: secondary, "historias": value}
        for (primary, secondary), value in counts.most_common()
    ]


def diagnosis_cross_table_rows(
    rows: list[dict[str, Any]],
    secondary_field: str,
    secondary_key: str,
) -> list[dict[str, Any]]:
    counts = Counter(
        (diagnosis, str(row.get(secondary_field) or "Sin dato"))
        for row in rows
        for diagnosis in (row.get("diagnosticos") or ["Sin diagnostico"])
    )
    return [
        {"diagnostico": diagnosis, secondary_key: secondary, "historias": value}
        for (diagnosis, secondary), value in counts.most_common()
    ]


def numeric_by_group_rows(
    rows: list[dict[str, Any]],
    numeric_field: str,
    group_field: str,
    group_key: str,
) -> list[dict[str, Any]]:
    grouped: dict[str, list[float]] = {}
    for row in rows:
        if not is_number(row.get(numeric_field)):
            continue
        raw_group = row.get(group_field)
        if group_field == "diagnosticos":
            groups = raw_group or ["Sin diagnostico"]
        else:
            groups = [raw_group or "Sin dato"]
        for group in groups:
            grouped.setdefault(str(group), []).append(float(row[numeric_field]))

    result = []
    for group, values in grouped.items():
        if not values:
            continue
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
