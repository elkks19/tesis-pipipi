import unittest

from app.db.chat_repository import truncate_memory_content
from app.llm.prompts import build_rag_messages
from app.models.documents import RetrievedChunk


class ChatMemoryTests(unittest.TestCase):
    def test_truncate_memory_content_keeps_short_text(self):
        self.assertEqual(truncate_memory_content("respuesta corta", 40), "respuesta corta")

    def test_truncate_memory_content_limits_long_text(self):
        result = truncate_memory_content("a" * 20, 8)

        self.assertEqual(result, "aaaaaaaa...")

    def test_build_rag_messages_includes_history_before_current_question(self):
        context = RetrievedChunk(
            chunk_id="chunk-1",
            document_id="historia-1",
            document_type="historia",
            metadata={"section": "anamnesis"},
            score=0.91,
            text="Paciente con antecedente registrado.",
            title="Historia 1",
        )
        messages = build_rag_messages(
            "Que antecedente tenia?",
            [context],
            history=[
                {"role": "user", "content": "Recuerda que hablamos de anamnesis."},
                {"role": "assistant", "content": "Listo, revisare anamnesis."},
            ],
        )

        self.assertEqual(messages[0]["role"], "system")
        self.assertEqual(messages[1]["content"], "Recuerda que hablamos de anamnesis.")
        self.assertEqual(messages[2]["role"], "assistant")
        self.assertIn("Contexto recuperado", messages[-1]["content"])
        self.assertIn("Que antecedente tenia?", messages[-1]["content"])


if __name__ == "__main__":
    unittest.main()
