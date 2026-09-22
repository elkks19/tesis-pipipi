import json
import unittest

from app.agent.tools import ResearchTools
from app.analytics.advanced import cluster_rows, numeric_correlations, numeric_outliers
from app.analytics.intent import detect_intent


class AdvancedAnalyticsTests(unittest.TestCase):
    def test_cluster_excludes_incomplete_rows_and_reports_group_profiles(self):
        rows = [
            {"imc": 20, "frecuenciaCardiaca": 60},
            {"imc": 21, "frecuenciaCardiaca": 62},
            {"imc": 30, "frecuenciaCardiaca": 90},
            {"imc": 31, "frecuenciaCardiaca": 92},
            {"imc": 33, "frecuenciaCardiaca": None},
        ]
        result = cluster_rows(rows, ["imc", "frecuenciaCardiaca"], 2)
        self.assertEqual(result["historiasCompletas"], 4)
        self.assertEqual(result["historiasExcluidas"], 1)
        self.assertEqual(sorted(group["historias"] for group in result["clusters"]), [2, 2])

    def test_cluster_handles_insufficient_and_constant_data(self):
        rows = [{"imc": 20, "frecuenciaCardiaca": 60}]
        self.assertEqual(cluster_rows(rows, ["imc", "frecuenciaCardiaca"], 2)["clusters"], [])
        constant = rows * 3
        self.assertIn("no varia", cluster_rows(constant, ["imc", "frecuenciaCardiaca"], 2)["nota"])

    def test_outliers_use_valid_values_and_report_bounds(self):
        rows = [{"imc": value} for value in [20, 20, 21, 21, 22, 100, None, "bad"]]
        result = numeric_outliers(rows, "imc", "iqr")
        self.assertEqual(result["valoresValidos"], 6)
        self.assertEqual(result["atipicos"], 1)
        self.assertEqual(result["valoresAtipicos"], [100.0])
        self.assertIsNotNone(numeric_outliers(rows, "imc", "zscore")["limiteSuperior"])

    def test_correlations_use_pairwise_complete_values(self):
        rows = [
            {"imc": 20, "glicemiaCapilar": 80},
            {"imc": 25, "glicemiaCapilar": 90},
            {"imc": 30, "glicemiaCapilar": 100},
            {"imc": 35, "glicemiaCapilar": None},
        ]
        pair = numeric_correlations(rows, ["imc", "glicemiaCapilar"])["correlaciones"][0]
        self.assertEqual(pair["paresValidos"], 3)
        self.assertEqual(pair["correlacion"], 1.0)

    def test_advanced_queries_reach_agent_even_when_asking_for_chart(self):
        self.assertEqual(detect_intent("Haz un grafico de clustering"), "advanced_analysis")
        self.assertEqual(detect_intent("Detecta valores atipicos"), "advanced_analysis")
        self.assertEqual(detect_intent("Correlacion entre IMC y glicemia"), "advanced_analysis")


class FakeRepository:
    async def fetch_historias(self, **filters):
        assert filters == {"viaje_ids": ["viaje:1"]}
        return [
            {
                "_id": f"historia:{index}",
                "viajeId": "viaje:1",
                "pacienteId": f"paciente:{index}",
                "examenFisicoGeneral": {"imc": imc, "frecuenciaCardiaca": pulse},
            }
            for index, (imc, pulse) in enumerate([(20, 60), (21, 62), (30, 90), (31, 92)])
        ]

    async def fetch_pacientes_for_historias(self, historias):
        return {}


class AdvancedToolCallingTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_three_tools_are_registered_and_return_artifacts(self):
        tools = ResearchTools(
            FakeRepository(), filters={"viaje_ids": ["viaje:1"]}, chart_type="auto",
            retriever_factory=lambda: None,
        )
        names = {definition["function"]["name"] for definition in tools.definitions()}
        self.assertTrue({"cluster_histories", "detect_numeric_outliers", "correlate_numeric_fields"} <= names)
        cases = [
            ("cluster_histories", {"fields": ["imc", "frecuenciaCardiaca"], "clusters": 2}),
            ("detect_numeric_outliers", {"field": "imc"}),
            ("correlate_numeric_fields", {"fields": ["imc", "frecuenciaCardiaca"]}),
        ]
        for name, arguments in cases:
            with self.subTest(name=name):
                result = await tools.execute(name, json.dumps(arguments))
                self.assertTrue(json.loads(result.content))
                self.assertTrue(result.artifacts)


if __name__ == "__main__":
    unittest.main()
