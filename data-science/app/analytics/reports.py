from collections import Counter
from dataclasses import dataclass
from statistics import mean, median
from typing import Any

from app.analytics.charts import chart_artifact, count_chart_artifact, table_artifact
from app.models.responses import Artifact


@dataclass(frozen=True)
class ResearchReport:
    answer: str
    artifacts: list[Artifact]


def build_report(rows: list[dict[str, Any]], report_type: str) -> ResearchReport:
    if report_type == "perfil_epidemiologico":
        return build_epidemiological_profile_report(rows)
    if report_type == "diagnosticos_poblacion":
        return build_population_diagnosis_report(rows)
    return build_research_report(rows)


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
            role="primary",
        ),
        count_chart_artifact(
            "Distribucion por genero",
            "genero",
            "historias",
            genders,
            kind="pie",
            role="breakdown",
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
                role="breakdown",
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
            role="summary",
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


def build_epidemiological_profile_report(rows: list[dict[str, Any]]) -> ResearchReport:
    if not rows:
        return empty_report("perfil epidemiologico")

    diagnoses = diagnosis_counts(rows, include_missing=True)
    genders = Counter(str(row.get("genero") or "Sin dato") for row in rows)
    age_groups = Counter(str(row.get("grupoEdad") or "Sin dato") for row in rows)
    imc_diagnoses = Counter(
        str(row.get("diagnosticoIMC") or "Sin dato")
        for row in rows
        if has_value(row.get("imc"))
    )
    imc_values = numeric_values(rows, "imc")
    indicators = [
        indicator_row("IMC", imc_values),
        indicator_row("Frecuencia cardiaca", numeric_values(rows, "frecuenciaCardiaca")),
        indicator_row("Presion arterial media", numeric_values(rows, "presionArterialMedia")),
        indicator_row("Glicemia capilar", numeric_values(rows, "glicemiaCapilar")),
    ]
    coverage = coverage_rows(rows)
    summary = summary_row(rows, diagnoses)
    artifacts: list[Artifact] = [
        table_artifact(
            "Resumen general del perfil",
            [summary],
            description="Totales principales del alcance seleccionado.",
            role="summary",
        ),
        count_chart_artifact(
            "Diagnosticos mas frecuentes",
            "diagnostico",
            "historias",
            diagnoses,
            description="Diagnosticos principales y secundarios registrados.",
            kind="bar",
            role="primary",
        ),
        count_chart_artifact(
            "Distribucion por genero",
            "genero",
            "historias",
            genders,
            description="Composicion poblacional por genero.",
            kind="pie",
            role="breakdown",
        ),
        count_chart_artifact(
            "Distribucion por grupo etario",
            "grupoEdad",
            "historias",
            age_groups,
            description="Composicion poblacional por grupos de edad.",
            kind="bar",
            role="breakdown",
        ),
    ]
    if imc_diagnoses:
        artifacts.append(
            count_chart_artifact(
                "Clasificacion de IMC",
                "clasificacion",
                "historias",
                imc_diagnoses,
                description="Clasificacion nutricional registrada en examen fisico general.",
                kind="bar",
                role="breakdown",
            )
        )
    if imc_values:
        artifacts.append(
            chart_artifact(
                "Frecuencia de IMC",
                "rango",
                "historias",
                numeric_frequency_rows(imc_values),
                description="Distribucion de IMC por rangos.",
                kind="bar",
                role="breakdown",
            )
        )
    artifacts.extend(
        [
            table_artifact(
                "Indicadores cardiometabolicos",
                [indicator for indicator in indicators if indicator["registros"] > 0],
                description="Resumen de indicadores numericos disponibles.",
                role="summary",
            ),
            table_artifact(
                "Cobertura de datos",
                coverage,
                description="Porcentaje de historias con campos clinicos clave.",
                role="summary",
            ),
        ]
    )

    return ResearchReport(
        (
            f"Prepare el perfil epidemiologico con {count_label(len(rows), 'historia', 'historias')}. "
            f"El reporte resume poblacion, diagnosticos, IMC, indicadores cardiometabolicos "
            f"y cobertura de datos. Hay {summary['conDiagnostico']} historias con diagnostico "
            f"y {summary['sinDiagnostico']} sin diagnostico registrado."
        ),
        artifacts,
    )


def build_population_diagnosis_report(rows: list[dict[str, Any]]) -> ResearchReport:
    if not rows:
        return empty_report("diagnosticos por poblacion")

    diagnoses = diagnosis_counts(rows, include_missing=True)
    summary = summary_row(rows, diagnoses)
    artifacts: list[Artifact] = [
        table_artifact(
            "Resumen diagnostico poblacional",
            [summary],
            description="Totales usados para los cruces poblacionales.",
            role="summary",
        ),
        count_chart_artifact(
            "Top diagnosticos registrados",
            "diagnostico",
            "historias",
            diagnoses,
            description="Diagnosticos principales y secundarios mas frecuentes.",
            kind="bar",
            role="primary",
        ),
    ]

    for title, secondary_field, secondary_key in [
        ("Diagnostico por genero", "genero", "genero"),
        ("Diagnostico por grupo etario", "grupoEdad", "grupoEdad"),
    ]:
        rows_for_heatmap = diagnosis_cross_rows(rows, secondary_field, secondary_key)
        if rows_for_heatmap:
            artifacts.append(
                chart_artifact(
                    title,
                    "diagnostico",
                    "historias",
                    rows_for_heatmap,
                    description=f"Cruce de diagnosticos por {secondary_key}.",
                    group=secondary_key,
                    kind="heatmap",
                    role="breakdown",
                )
            )

    by_trip = diagnosis_cross_rows(rows, "viajeId", "viaje")
    if by_trip:
        artifacts.append(
            table_artifact(
                "Diagnostico por viaje",
                by_trip,
                description="Cruce de diagnosticos por viaje o campana.",
                role="breakdown",
            )
        )

    by_imc = diagnosis_cross_rows(rows, "diagnosticoIMC", "clasificacionIMC")
    if by_imc:
        artifacts.append(
            table_artifact(
                "Diagnostico por clasificacion IMC",
                by_imc,
                description="Cruce de diagnosticos con clasificacion nutricional.",
                role="breakdown",
            )
        )

    return ResearchReport(
        (
            f"Prepare el reporte de diagnosticos por poblacion con "
            f"{count_label(len(rows), 'historia', 'historias')}. Incluye top diagnosticos "
            "y cruces por genero, grupo etario, viaje y clasificacion IMC cuando hay datos."
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


def has_value(value: Any) -> bool:
    return value is not None and value != ""


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
        "mediana": round(median(values), 2),
        "minimo": round(min(values), 2),
        "maximo": round(max(values), 2),
    }


def count_label(value: int, singular: str, plural: str) -> str:
    return f"{value} {singular if value == 1 else plural}"


def empty_report(name: str) -> ResearchReport:
    return ResearchReport(
        f"No encontre historias dentro del alcance seleccionado para preparar el reporte de {name}.",
        [],
    )


def diagnosis_counts(
    rows: list[dict[str, Any]],
    *,
    include_missing: bool,
) -> Counter[str]:
    diagnoses = Counter(
        diagnosis
        for row in rows
        for diagnosis in row.get("diagnosticos") or []
    )
    if include_missing:
        missing = sum(1 for row in rows if not (row.get("diagnosticos") or []))
        if missing:
            diagnoses["Sin diagnostico"] = missing
    return diagnoses


def summary_row(rows: list[dict[str, Any]], diagnoses: Counter[str]) -> dict[str, Any]:
    missing = sum(1 for row in rows if not (row.get("diagnosticos") or []))
    diagnosed = len(rows) - missing
    return {
        "historias": len(rows),
        "conDiagnostico": diagnosed,
        "sinDiagnostico": missing,
        "diagnosticosRegistrados": sum(
            value for key, value in diagnoses.items() if key != "Sin diagnostico"
        ),
        "generos": len({str(row.get("genero") or "Sin dato") for row in rows}),
        "gruposEdad": len({str(row.get("grupoEdad") or "Sin dato") for row in rows}),
        "viajes": len({str(row.get("viajeId") or "Sin dato") for row in rows}),
    }


def coverage_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    total = len(rows)
    checks = [
        ("Diagnostico", lambda row: bool(row.get("diagnosticos") or [])),
        ("IMC", lambda row: has_value(row.get("imc"))),
        ("Signos vitales", lambda row: has_value(row.get("frecuenciaCardiaca")) or has_value(row.get("presionArterialMedia"))),
        ("Glicemia capilar", lambda row: has_value(row.get("glicemiaCapilar"))),
    ]
    return [
        {
            "campo": label,
            "historias": count,
            "porcentaje": round((count / max(total, 1)) * 100, 1),
        }
        for label, predicate in checks
        for count in [sum(1 for row in rows if predicate(row))]
    ]


def diagnosis_cross_rows(
    rows: list[dict[str, Any]],
    secondary_field: str,
    secondary_key: str,
    *,
    limit: int = 40,
) -> list[dict[str, Any]]:
    counts = Counter(
        (diagnosis, str(row.get(secondary_field) or "Sin dato"))
        for row in rows
        for diagnosis in (row.get("diagnosticos") or ["Sin diagnostico"])
    )
    return [
        {
            "diagnostico": diagnosis,
            secondary_key: secondary,
            "historias": value,
        }
        for (diagnosis, secondary), value in counts.most_common(limit)
    ]


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
