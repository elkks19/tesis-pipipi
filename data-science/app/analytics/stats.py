from collections import Counter
from dataclasses import dataclass
from statistics import mean
from typing import Any

from app.analytics.charts import count_chart_artifact, table_artifact
from app.models.responses import Artifact


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

    if "genero" in text or "género" in text:
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

    if "imc" in text:
        values = [float(row["imc"]) for row in rows if is_number(row.get("imc"))]
        if not values:
            return AnalyticsAnswer("No encontre valores de IMC en las historias filtradas.", [])
        summary_rows = [
            {
                "historiasConIMC": len(values),
                "promedio": round(mean(values), 2),
                "minimo": round(min(values), 2),
                "maximo": round(max(values), 2),
            }
        ]
        artifact = table_artifact("Resumen de IMC", summary_rows)
        return AnalyticsAnswer(
            f"El IMC promedio es {round(mean(values), 2)} sobre {len(values)} historias con dato disponible.",
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
        artifacts = [artifact]
        if by_gender:
            artifacts.append(table_artifact("Diagnosticos por genero", by_gender))
        if by_age:
            artifacts.append(table_artifact("Diagnosticos por grupo de edad", by_age))
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
            value_key=value_key,
        )

    kind = normalize_chart_type(chart_type, text)
    return count_chart_artifact(title, label_key, value_key, counts, kind=kind)


def normalize_chart_type(chart_type: str, text: str) -> str:
    if chart_type in {"bar", "line", "pie"}:
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
