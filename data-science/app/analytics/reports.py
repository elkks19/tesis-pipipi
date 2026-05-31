from collections import Counter
from dataclasses import dataclass
from statistics import mean
from typing import Any

from app.analytics.charts import count_chart_artifact, table_artifact
from app.models.responses import Artifact


@dataclass(frozen=True)
class ResearchReport:
    answer: str
    artifacts: list[Artifact]


def build_research_report(rows: list[dict[str, Any]]) -> ResearchReport:
    if not rows:
        return ResearchReport(
            "No encontre historias dentro del alcance seleccionado para preparar el reporte.",
            [],
        )

    diagnoses = Counter(
        diagnosis
        for row in rows
        for diagnosis in row.get("diagnosticos") or []
    )
    undiagnosed_histories = sum(
        1 for row in rows if not (row.get("diagnosticos") or [])
    )
    if undiagnosed_histories:
        diagnoses["Sin diagnostico"] = undiagnosed_histories
    genders = Counter(str(row.get("genero") or "Sin dato") for row in rows)
    imc_diagnoses = Counter(
        str(row.get("diagnosticoIMC") or "Sin dato")
        for row in rows
        if row.get("imc") is not None and row.get("imc") != ""
    )
    imc_values = numeric_values(rows, "imc")
    heart_rates = numeric_values(rows, "frecuenciaCardiaca")
    mean_pressures = numeric_values(rows, "presionArterialMedia")
    glycemia_values = numeric_values(rows, "glicemiaCapilar")
    diagnosed_histories = len(rows) - undiagnosed_histories
    registered_diagnoses = sum(
        value for key, value in diagnoses.items() if key != "Sin diagnostico"
    )

    artifacts = [
        table_artifact(
            "Resumen general",
            [
                {
                    "historias": len(rows),
                    "conDiagnostico": diagnosed_histories,
                    "sinDiagnostico": undiagnosed_histories,
                    "diagnosticosRegistrados": registered_diagnoses,
                    "conIMC": len(imc_values),
                }
            ],
        ),
        count_chart_artifact(
            "Todos los diagnosticos registrados",
            "diagnostico",
            "historias",
            diagnoses,
            kind="bar",
        ),
        count_chart_artifact(
            "Distribucion por genero",
            "genero",
            "historias",
            genders,
            kind="pie",
        ),
    ]

    if imc_diagnoses:
        artifacts.append(
            count_chart_artifact(
                "Clasificacion de IMC",
                "clasificacion",
                "historias",
                imc_diagnoses,
                kind="bar",
            )
        )

    indicators = [
        indicator_row("IMC", imc_values),
        indicator_row("Frecuencia cardiaca", heart_rates),
        indicator_row("Presion arterial media", mean_pressures),
        indicator_row("Glicemia capilar", glycemia_values),
    ]
    artifacts.append(
        table_artifact(
            "Indicadores disponibles",
            [indicator for indicator in indicators if indicator["registros"] > 0],
        )
    )

    return ResearchReport(
        (
            f"Prepare un reporte con {count_label(len(rows), 'historia', 'historias')} "
            f"dentro del alcance seleccionado. Encontre "
            f"{count_label(registered_diagnoses, 'diagnostico registrado', 'diagnosticos registrados')} "
            f"en {count_label(diagnosed_histories, 'historia', 'historias')}. "
            f"{count_label(undiagnosed_histories, 'historia', 'historias')} "
            f"{'todavia no cuenta' if undiagnosed_histories == 1 else 'todavia no cuentan'} "
            "con diagnosticos."
        ),
        artifacts,
    )


def numeric_values(rows: list[dict[str, Any]], key: str) -> list[float]:
    values: list[float] = []
    for row in rows:
        try:
            value = row.get(key)
            if value is not None and value != "":
                values.append(float(value))
        except (TypeError, ValueError):
            continue
    return values


def indicator_row(label: str, values: list[float]) -> dict[str, Any]:
    if not values:
        return {
            "indicador": label,
            "registros": 0,
            "promedio": "",
            "minimo": "",
            "maximo": "",
        }

    return {
        "indicador": label,
        "registros": len(values),
        "promedio": round(mean(values), 2),
        "minimo": round(min(values), 2),
        "maximo": round(max(values), 2),
    }


def count_label(value: int, singular: str, plural: str) -> str:
    return f"{value} {singular if value == 1 else plural}"
