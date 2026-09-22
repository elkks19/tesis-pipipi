import unittest

from app.analytics.reports import build_report


ROWS = [
    {
        "diagnosticoIMC": "Normal",
        "diagnosticos": ["Anemia"],
        "frecuenciaCardiaca": 82,
        "genero": "Femenino",
        "glicemiaCapilar": 95,
        "grupoEdad": "18-29",
        "imc": 22.5,
        "presionArterialMedia": 87,
        "viajeId": "viaje-1",
    },
    {
        "diagnosticoIMC": "Sobrepeso",
        "diagnosticos": ["Hipertension", "Anemia"],
        "frecuenciaCardiaca": 78,
        "genero": "Masculino",
        "glicemiaCapilar": 108,
        "grupoEdad": "30-44",
        "imc": 27.2,
        "presionArterialMedia": 94,
        "viajeId": "viaje-1",
    },
    {
        "diagnosticoIMC": "",
        "diagnosticos": [],
        "frecuenciaCardiaca": None,
        "genero": "Femenino",
        "glicemiaCapilar": None,
        "grupoEdad": "18-29",
        "imc": None,
        "presionArterialMedia": None,
        "viajeId": "viaje-2",
    },
]


class ReportsTests(unittest.TestCase):
    def test_default_report_keeps_general_behavior(self):
        report = build_report(ROWS, "general")

        self.assertIn("Prepare un reporte", report.answer)
        self.assertEqual(report.artifacts[0].title, "Resumen general")

    def test_unknown_report_type_falls_back_to_general(self):
        report = build_report(ROWS, "desconocido")

        self.assertIn("Prepare un reporte", report.answer)
        self.assertEqual(report.artifacts[0].title, "Resumen general")

    def test_epidemiological_profile_returns_expected_artifacts(self):
        report = build_report(ROWS, "perfil_epidemiologico")
        titles = [artifact.title for artifact in report.artifacts]

        self.assertIn("perfil epidemiologico", report.answer)
        self.assertIn("Diagnosticos mas frecuentes", titles)
        self.assertIn("Distribucion por genero", titles)
        self.assertIn("Distribucion por grupo etario", titles)
        self.assertIn("Frecuencia de IMC", titles)
        self.assertIn("Cobertura de datos", titles)
        self.assertEqual(report.artifacts[1].spec["role"], "primary")

    def test_population_diagnosis_report_returns_crossings(self):
        report = build_report(ROWS, "diagnosticos_poblacion")
        titles = [artifact.title for artifact in report.artifacts]

        self.assertIn("diagnosticos por poblacion", report.answer)
        self.assertIn("Top diagnosticos registrados", titles)
        self.assertIn("Diagnostico por genero", titles)
        self.assertIn("Diagnostico por grupo etario", titles)
        self.assertIn("Diagnostico por viaje", titles)
        self.assertIn("Diagnostico por clasificacion IMC", titles)

    def test_empty_reports_return_clear_message_without_artifacts(self):
        for report_type in ["perfil_epidemiologico", "diagnosticos_poblacion"]:
            report = build_report([], report_type)

            self.assertIn("No encontre historias", report.answer)
            self.assertEqual(report.artifacts, [])


if __name__ == "__main__":
    unittest.main()
