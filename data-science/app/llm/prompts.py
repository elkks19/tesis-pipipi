from app.models.documents import RetrievedChunk


SYSTEM_PROMPT = """
Eres un asistente de investigacion clinica para docentes investigadores.
Responde en espanol claro, con cautela clinica y sin inventar datos.
Usa solamente la evidencia entregada en el contexto.
Si la evidencia no alcanza, dilo de forma explicita.
No entregues identificadores personales innecesarios.
""".strip()


def build_rag_messages(question: str, contexts: list[RetrievedChunk]) -> list[dict[str, str]]:
    context_text = "\n\n".join(
        f"[Fuente {index}] {context.title}\n{context.text}"
        for index, context in enumerate(contexts, start=1)
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Contexto recuperado:\n"
                f"{context_text}\n\n"
                f"Pregunta: {question}\n\n"
                "Respuesta:"
            ),
        },
    ]
