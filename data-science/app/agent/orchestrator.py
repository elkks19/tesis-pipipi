import json
from dataclasses import dataclass
from typing import Any

from app.agent.tools import ResearchTools
from app.llm.ollama_client import OllamaClient, strip_thinking
from app.models.responses import Artifact, Source

MAX_TOOL_ROUNDS = 4

SYSTEM_PROMPT = """
Eres un asistente de investigacion clinica para docentes investigadores.
Responde en espanol claro, completo y con cautela clinica.
Para responder preguntas sobre datos debes usar las herramientas disponibles.
Nunca inventes conteos, estadisticas ni evidencia narrativa.
No solicites identificadores personales ni expongas datos innecesarios.
Los filtros de viajes y estacion ya fueron fijados por el backend y no puedes cambiarlos.
Puedes ejecutar varias herramientas si la pregunta requiere comparar o combinar resultados.

Cuando el usuario pida un grafico, tabla, conteo o distribucion, entrega lo pedido y
agrega cruces utiles si estan relacionados con la pregunta:
- genero: agrega distribucion por viaje si hay datos suficientes.
- diagnosticos o enfermedades: agrega distribucion por grupo de edad y por genero.
- indicadores clinicos numericos: agrega resumen numerico y, si aporta contexto, IMC o viaje.
- viaje/campana: agrega una comparacion con genero o diagnosticos si corresponde.

Prioriza 2 a 4 resultados accionables, no una lista larga. Si una herramienta genera una
tabla o grafica, menciona el hallazgo principal y las limitaciones de datos faltantes sin
repetir toda la tabla. Si no existe evidencia suficiente, dilo de forma explicita.
""".strip()


@dataclass(frozen=True)
class AgentAnswer:
    answer: str
    artifacts: list[Artifact]
    sources: list[Source]


class ResearchAgent:
    def __init__(self, ollama: OllamaClient, tools: ResearchTools) -> None:
        self.ollama = ollama
        self.tools = tools

    async def answer(
        self,
        question: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> AgentAnswer:
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
        ]
        messages.extend(history or [])
        messages.append({"role": "user", "content": question})
        artifacts: list[Artifact] = []
        sources: dict[str, Source] = {}

        for _ in range(MAX_TOOL_ROUNDS):
            assistant = await self.ollama.chat_message(
                messages,
                tools=self.tools.definitions(),
            )
            messages.append(assistant)
            tool_calls = assistant.get("tool_calls") or []
            if not tool_calls:
                return AgentAnswer(
                    answer=assistant_text(assistant),
                    artifacts=artifacts,
                    sources=list(sources.values()),
                )

            for tool_call in tool_calls:
                function = tool_call.get("function") or {}
                name = str(function.get("name") or "")
                try:
                    execution = await self.tools.execute(name, function.get("arguments"))
                    content = execution.content
                    artifacts.extend(execution.artifacts)
                    for source in execution.sources:
                        sources[source.chunk_id] = source
                except Exception as exc:
                    content = json.dumps(
                        {
                            "error": str(exc),
                            "nota": "Corrige los argumentos o usa otra herramienta permitida.",
                        },
                        ensure_ascii=False,
                    )

                messages.append(
                    {
                        "role": "tool",
                        "tool_name": name,
                        "content": content,
                    }
                )

        messages.append(
            {
                "role": "user",
                "content": (
                    "Redacta la respuesta final usando solamente los resultados obtenidos. "
                    "Incluye los cruces complementarios que ya calculaste cuando aporten contexto. "
                    "No llames mas herramientas."
                ),
            }
        )
        assistant = await self.ollama.chat_message(messages)
        return AgentAnswer(
            answer=assistant_text(assistant),
            artifacts=artifacts,
            sources=list(sources.values()),
        )


def assistant_text(message: dict[str, Any]) -> str:
    content = str(message.get("content") or "").strip()
    content = strip_thinking(content)
    return content or "No encontre informacion suficiente para responder eso."
