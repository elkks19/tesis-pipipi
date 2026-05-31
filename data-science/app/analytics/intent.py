def detect_intent(message: str) -> str:
    text = message.lower()
    if any(word in text for word in ["grafica", "gráfica", "grafico", "gráfico", "chart"]):
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
            "listado",
            "porcentaje",
            "promedio",
            "tabla",
        ]
    ):
        return "statistic"
    if any(word in text for word in ["resume", "resumen", "sintetiza"]):
        return "summary"
    return "semantic_search"
