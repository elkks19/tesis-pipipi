import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from app.agent.tools import ResearchTools
from app.llm.client import ChatClient
from app.llm.ollama_client import strip_thinking
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

IMPORTANTE: Para CUALQUIER pregunta que involucre datos clinicos o historias de pacientes,
SIEMPRE usa las herramientas. Incluso para preguntas simples como conteos o distribuciones,
llama a la herramienta correspondiente.

Cuando la pregunta necesite contexto narrativo o comprension de las historias clinicas
(por ejemplo: "que enfermedades se vieron en el ultimo viaje", "como estaban los pacientes",
"que patrones observas"), SIEMPRE llama a search_clinical_context ademas de las herramientas
de datos para enriquecer tu respuesta con evidencia narrativa del indice clinico.

Para agrupamiento de historias usa cluster_histories; para valores atipicos usa
detect_numeric_outliers; para relaciones entre indicadores usa correlate_numeric_fields.
Estas herramientas describen patrones estadisticos, no diagnosticos individuales.

Cuando el usuario pida un grafico, tabla, conteo o distribucion, entrega lo pedido y
agrega cruces utiles si estan relacionados con la pregunta:
- genero: agrega distribucion por viaje si hay datos suficientes.
- diagnosticos o enfermedades: agrega distribucion por grupo de edad y por genero.
- indicadores clinicos numericos: usa numeric_distribution si pidieron frecuencia/grafico
  y compare_numeric_by_group si pidieron comparacion por genero, viaje o grupo de edad.
- viaje/campana: agrega una comparacion con genero o diagnosticos si corresponde.

Prioriza 2 a 4 resultados accionables, no una lista larga. Si una herramienta genera una
tabla o grafica, menciona el hallazgo principal y las limitaciones de datos faltantes sin
repetir toda la tabla. Si no existe evidencia suficiente, dilo de forma explicita.

Despues de obtener resultados de las herramientas, redacta una respuesta interpretativa:
no solo repitas los numeros, sino ofrece una lectura clinica, menciona tendencias,
y sugiere posibles interpretaciones con la cautela apropiada.

Si el usuario pregunta por un dato que no existe en el sistema (como estado civil,
ocupacion, escolaridad, etc.), usa list_available_fields para confirmar que campos
hay disponibles y responde claramente que ese dato no se recolecta en el sistema actual.
No digas que "la funcion no lo permite" — di que el dato simplemente no se registra.
""".strip()


@dataclass(frozen=True)
class AgentAnswer:
    answer: str
    artifacts: list[Artifact]
    sources: list[Source]


class ResearchAgent:
    def __init__(self, chat_client: ChatClient, tools: ResearchTools) -> None:
        self.chat_client = chat_client
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
            assistant = await self.chat_client.chat_message(
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

                tool_message = {
                    "role": "tool",
                    "content": content,
                    "tool_call_id": tool_call.get("id") or f"call_{name}_{_}",
                }
                messages.append(tool_message)

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
        assistant = await self.chat_client.chat_message(messages)
        return AgentAnswer(
            answer=assistant_text(assistant),
            artifacts=artifacts,
            sources=list(sources.values()),
        )


def assistant_text(message: dict[str, Any]) -> str:
    content = str(message.get("content") or "").strip()
    content = strip_thinking(content)
    return content or "No encontre informacion suficiente para responder eso."


@dataclass(frozen=True)
class StreamPreamble:
    """Data collected during tool-call rounds, before streaming the final answer."""
    artifacts: list[Artifact]
    sources: list[Source]
    messages: list[dict[str, Any]]


class ResearchAgentStreamer:
    """Runs tool rounds, then streams the final answer token by token."""

    def __init__(self, chat_client: Any, tools: ResearchTools) -> None:
        self.chat_client = chat_client
        self.tools = tools

    async def prepare(
        self,
        question: str,
        *,
        history: list[dict[str, str]] | None = None,
    ) -> StreamPreamble:
        """Execute tool rounds (non-streaming) and return context for streaming."""
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
        ]
        messages.extend(history or [])
        messages.append({"role": "user", "content": question})
        artifacts: list[Artifact] = []
        sources: dict[str, Source] = {}

        for _ in range(MAX_TOOL_ROUNDS):
            assistant = await self.chat_client.chat_message(
                messages,
                tools=self.tools.definitions(),
            )
            messages.append(assistant)
            tool_calls = assistant.get("tool_calls") or []
            if not tool_calls:
                # No tools needed — the assistant already responded
                return StreamPreamble(
                    artifacts=artifacts,
                    sources=list(sources.values()),
                    messages=messages,
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
                        {"error": str(exc), "nota": "Corrige los argumentos o usa otra herramienta."},
                        ensure_ascii=False,
                    )

                tool_message: dict[str, Any] = {
                    "role": "tool",
                    "content": content,
                    "tool_call_id": tool_call.get("id") or f"call_{name}_{_}",
                }
                messages.append(tool_message)

        # Exhausted tool rounds — ask for final answer
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
        return StreamPreamble(
            artifacts=artifacts,
            sources=list(sources.values()),
            messages=messages,
        )

    async def stream_answer(self, preamble: StreamPreamble) -> AsyncIterator[str]:
        """Stream the final LLM answer token by token."""
        if hasattr(self.chat_client, "chat_stream"):
            async for token in self.chat_client.chat_stream(preamble.messages):
                cleaned = strip_thinking(token)
                if cleaned:
                    yield cleaned
        else:
            # Fallback for clients without streaming
            assistant = await self.chat_client.chat_message(preamble.messages)
            yield assistant_text(assistant)
