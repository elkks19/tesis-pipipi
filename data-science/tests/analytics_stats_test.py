import unittest

from app.analytics.stats import answer_with_statistics


class AnalyticsStatsTests(unittest.TestCase):
    def test_average_frequency_uses_deterministic_statistics(self):
        response = answer_with_statistics(
            "Cual es el promedio de frecuencia cardiaca?",
            [
                {"frecuenciaCardiaca": 70},
                {"frecuenciaCardiaca": "80"},
                {"frecuenciaCardiaca": None},
            ],
            "statistic",
        )

        self.assertIn("promedio de frecuencia cardiaca es 75.0", response.answer)
        self.assertEqual(response.artifacts[0].title, "Resumen de frecuencia cardiaca")

    def test_unknown_statistic_returns_story_count(self):
        response = answer_with_statistics(
            "Cuantas historias hay?",
            [{"historiaId": "1"}, {"historiaId": "2"}],
            "statistic",
        )

        self.assertIn("Encontre 2 historias", response.answer)
        self.assertEqual(response.artifacts[0].title, "Conteo de historias")


if __name__ == "__main__":
    unittest.main()
