import unittest

from app.db.chat_repository import (
    build_memory_message,
    extract_explicit_memory_facts,
    merge_memory_facts,
    truncate_memory_content,
    update_chat_memory,
)
from app.llm.prompts import build_rag_messages
from app.models.documents import RetrievedChunk


class ChatMemoryTests(unittest.TestCase):
    def test_truncate_memory_content_keeps_short_text(self):
        self.assertEqual(truncate_memory_content("respuesta corta", 40), "respuesta corta")

    def test_truncate_memory_content_limits_long_text(self):
        result = truncate_memory_content("a" * 20, 8)

        self.assertEqual(result, "aaaaaaaa...")

    def test_extract_explicit_memory_facts_detects_reminders(self):
        facts = extract_explicit_memory_facts(
            "Recuerda que para este chat debemos comparar por genero.",
            "",
        )

        self.assertEqual(facts, ["Recuerda que para este chat debemos comparar por genero."])

    def test_update_chat_memory_keeps_summary_and_facts(self):
        memory = update_chat_memory(
            None,
            answer="Se encontro mayor frecuencia en el viaje activo.",
            intent="agent",
            question="Recuerda que me interesan los viajes activos",
            scope={"role": "investigador", "viajeIds": ["viaje-1"]},
        )

        self.assertIn("viajes viaje-1", memory["summary"])
        self.assertIn("Recuerda que me interesan los viajes activos", memory["facts"][0])

    def test_build_memory_message_returns_system_context(self):
        message = build_memory_message(
            {
                "summary": "Usuario revisa diagnosticos por viaje.",
                "facts": ["Priorizar comparaciones por genero."],
            }
        )

        self.assertIsNotNone(message)
        assert message is not None
        self.assertEqual(message["role"], "system")
        self.assertIn("memoria persistente", message["content"].lower())
        self.assertIn("Priorizar comparaciones por genero", message["content"])

    def test_merge_memory_facts_deduplicates_and_limits(self):
        facts = merge_memory_facts(
            ["dato repetido", "dato repetido"],
            [f"dato {index}" for index in range(20)],
        )

        self.assertEqual(len(facts), 16)
        self.assertEqual(facts[-1], "dato 19")

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
