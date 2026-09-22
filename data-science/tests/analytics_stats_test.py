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

    def test_imc_frequency_chart_uses_numeric_distribution(self):
        response = answer_with_statistics(
            "puedes hacer un grafico de frecuencia de los valores del indice de masa corporal en el dataset?",
            [
                {"imc": 18.5},
                {"imc": 21.2},
                {"imc": 21.8},
                {"imc": 27.4},
                {"imc": 31.1},
                {"imc": None},
            ],
            "chart",
        )

        self.assertIn("Encontre 5 valores de IMC", response.answer)
        self.assertEqual(response.artifacts[0].title, "Frecuencia de IMC")
        self.assertEqual(response.artifacts[0].type, "chart")
        self.assertEqual(response.artifacts[0].spec["x"], "rango")
        self.assertEqual(response.artifacts[0].spec["y"], "historias")
        self.assertEqual(response.artifacts[0].spec["role"], "primary")
        self.assertGreater(len(response.artifacts[0].data), 1)

    def test_imc_by_gender_returns_multivariable_package(self):
        response = answer_with_statistics(
            "Compara IMC por genero",
            [
                {"genero": "Femenino", "imc": 22.4},
                {"genero": "Femenino", "imc": 24.2},
                {"genero": "Masculino", "imc": 27.1},
                {"genero": "Masculino", "imc": None},
            ],
            "statistic",
        )

        self.assertIn("Compare el indicador por genero", response.answer)
        self.assertEqual(response.artifacts[0].title, "IMC promedio por genero")
        self.assertEqual(response.artifacts[0].spec["role"], "primary")
        self.assertEqual(response.artifacts[1].spec["role"], "breakdown")
        self.assertEqual(response.artifacts[2].spec["role"], "summary")

    def test_diagnosis_by_age_and_gender_includes_heatmap(self):
        response = answer_with_statistics(
            "Cruza diagnosticos por grupo de edad y genero",
            [
                {
                    "diagnosticos": ["Anemia"],
                    "genero": "Femenino",
                    "grupoEdad": "18-29",
                },
                {
                    "diagnosticos": ["Anemia"],
                    "genero": "Masculino",
                    "grupoEdad": "18-29",
                },
                {
                    "diagnosticos": ["HTA"],
                    "genero": "Femenino",
                    "grupoEdad": "30-44",
                },
            ],
            "chart",
        )

        heatmaps = [
            artifact
            for artifact in response.artifacts
            if artifact.spec and artifact.spec.get("kind") == "heatmap"
        ]
        self.assertEqual(len(heatmaps), 1)
        self.assertEqual(heatmaps[0].spec["group"], "genero")

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
