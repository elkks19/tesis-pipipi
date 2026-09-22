def detect_intent(message: str) -> str:
    text = message.lower()
    if any(word in text for word in [
        "cluster", "clúster", "agrupamiento", "atipic", "atípic",
        "outlier", "anomalia", "anomalía", "correlacion", "correlación",
    ]):
        return "advanced_analysis"
    if any(
        word in text
        for word in [
            "grafica",
            "gráfica",
            "grafico",
            "gráfico",
            "chart",
            "histograma",
        ]
    ):
        return "chart"
    if any(
        word in text
        for word in [
            "conteo",
            "cuantos",
            "cuántos",
            "distribucion",
            "distribución",
            "frecuencia",
            "frecuencias",
            "listado",
            "porcentaje",
            "promedio",
            "rangos",
            "tabla",
        ]
    ):
        return "statistic"
    if any(word in text for word in ["resume", "resumen", "sintetiza"]):
        return "summary"
    return "semantic_search"
