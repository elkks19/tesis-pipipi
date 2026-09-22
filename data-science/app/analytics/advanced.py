from itertools import combinations
from typing import Any

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def finite_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if np.isfinite(number) else None


def validate_fields(fields: list[str]) -> None:
    if len(set(fields)) != len(fields):
        raise ValueError("Selecciona indicadores distintos.")


def cluster_rows(rows: list[dict[str, Any]], fields: list[str], clusters: int) -> dict[str, Any]:
    validate_fields(fields)
    complete = []
    for row in rows:
        values = [finite_number(row.get(field)) for field in fields]
        if all(value is not None for value in values):
            complete.append(values)
    count = len(complete)
    result: dict[str, Any] = {
        "historiasAnalizadas": len(rows),
        "historiasCompletas": count,
        "historiasExcluidas": len(rows) - count,
        "indicadores": fields,
        "metodo": "KMeans con StandardScaler",
        "clusters": [],
    }
    if count < clusters:
        result["nota"] = "No hay suficientes historias con todos los indicadores para ese numero de grupos."
        return result

    matrix = np.asarray(complete, dtype=np.float64)
    if any(np.ptp(matrix[:, index]) == 0 for index in range(len(fields))):
        result["nota"] = "Al menos un indicador no varia en las historias completas."
        return result

    scaled = StandardScaler().fit_transform(matrix)
    if np.unique(scaled, axis=0).shape[0] < clusters:
        result["nota"] = "Hay menos perfiles distintos que grupos solicitados."
        return result

    labels = KMeans(n_clusters=clusters, n_init=10, random_state=42).fit_predict(scaled)
    result["clusters"] = [
        {
            "grupo": f"Grupo {index + 1}",
            "historias": int(np.count_nonzero(labels == index)),
            **{
                field: round(float(np.mean(matrix[labels == index, field_index])), 2)
                for field_index, field in enumerate(fields)
            },
        }
        for index in range(clusters)
    ]
    return result


def numeric_outliers(rows: list[dict[str, Any]], field: str, method: str) -> dict[str, Any]:
    values = [value for row in rows if (value := finite_number(row.get(field))) is not None]
    result: dict[str, Any] = {
        "historiasAnalizadas": len(rows),
        "valoresValidos": len(values),
        "metodo": method,
        "indicador": field,
        "atipicos": 0,
        "limiteInferior": None,
        "limiteSuperior": None,
        "valoresAtipicos": [],
    }
    if len(values) < 4:
        result["nota"] = "Se necesitan al menos cuatro valores validos."
        return result

    array = np.asarray(values, dtype=np.float64)
    if method == "iqr":
        q1, q3 = np.percentile(array, [25, 75])
        spread = q3 - q1
        low, high = q1 - 1.5 * spread, q3 + 1.5 * spread
        result["criterio"] = "Fuera de Q1 - 1.5*IQR o Q3 + 1.5*IQR"
    else:
        average = float(np.mean(array))
        deviation = float(np.std(array))
        if deviation == 0:
            result["nota"] = "El indicador no varia entre los valores validos."
            return result
        low, high = average - 3 * deviation, average + 3 * deviation
        result["criterio"] = "Distancia superior a 3 desviaciones estandar de la media"

    flagged = array[(array < low) | (array > high)]
    result["limiteInferior"] = round(float(low), 2)
    result["limiteSuperior"] = round(float(high), 2)
    result["atipicos"] = len(flagged)
    result["valoresAtipicos"] = [round(float(value), 2) for value in np.sort(flagged)[:20]]
    if len(flagged) > 20:
        result["nota"] = "Se muestran hasta 20 valores atipicos; el conteo incluye todos."
    return result


def numeric_correlations(rows: list[dict[str, Any]], fields: list[str]) -> dict[str, Any]:
    validate_fields(fields)
    pairs = []
    for first, second in combinations(fields, 2):
        complete = [
            (a, b)
            for row in rows
            if (a := finite_number(row.get(first))) is not None
            and (b := finite_number(row.get(second))) is not None
        ]
        entry: dict[str, Any] = {
            "indicadorA": first,
            "indicadorB": second,
            "paresValidos": len(complete),
            "correlacion": None,
        }
        if len(complete) >= 3:
            matrix = np.asarray(complete, dtype=np.float64)
            if np.ptp(matrix[:, 0]) > 0 and np.ptp(matrix[:, 1]) > 0:
                entry["correlacion"] = round(float(np.corrcoef(matrix[:, 0], matrix[:, 1])[0, 1]), 3)
        pairs.append(entry)

    return {
        "historiasAnalizadas": len(rows),
        "metodo": "Pearson; pares completos por combinacion",
        "correlaciones": pairs,
        "nota": "Correlacion estadistica; no demuestra causalidad.",
    }
