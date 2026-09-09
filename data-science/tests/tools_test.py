import unittest

from app.agent.tools import normalize_arguments


class ToolsTests(unittest.TestCase):
    def test_normalize_arguments_accepts_groq_null_string_for_empty_arguments(self):
        self.assertEqual(normalize_arguments("null"), {})

    def test_normalize_arguments_accepts_none_for_empty_arguments(self):
        self.assertEqual(normalize_arguments(None), {})

    def test_normalize_arguments_parses_json_object(self):
        self.assertEqual(normalize_arguments('{"field": "genero"}'), {"field": "genero"})


if __name__ == "__main__":
    unittest.main()
