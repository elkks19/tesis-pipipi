import asyncio
import unittest

from app.agent.orchestrator import ResearchAgent
from app.agent.tools import ToolExecution


class FakeChatClient:
    def __init__(self):
        self.calls = 0

    async def chat_message(self, _messages, *, tools=None):
        self.calls += 1
        if self.calls == 1:
            return {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_ok",
                        "function": {"name": "count_histories", "arguments": {}},
                    },
                    {
                        "id": "call_error",
                        "function": {"name": "search_clinical_context", "arguments": {}},
                    },
                ],
            }
        return {"role": "assistant", "content": "Respuesta final"}


class FakeTools:
    @staticmethod
    def definitions():
        return []

    async def execute(self, name, _arguments):
        if name == "search_clinical_context":
            raise RuntimeError("fallo controlado")
        return ToolExecution(content='{"total": 2}', artifacts=[], sources=[])


class ResearchAgentAuditTests(unittest.TestCase):
    def test_records_each_tool_result_without_storing_tool_error_in_the_answer(self):
        answer = asyncio.run(
            ResearchAgent(FakeChatClient(), FakeTools()).answer("Consulta")
        )

        self.assertEqual(answer.answer, "Respuesta final")
        self.assertEqual(
            answer.tool_runs,
            [
                {"name": "count_histories", "status": "succeeded"},
                {"name": "search_clinical_context", "status": "failed"},
            ],
        )


if __name__ == "__main__":
    unittest.main()
