from typing import Any


def build_story_rows(
    historias: list[dict[str, Any]],
    pacientes_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for historia in historias:
        paciente = pacientes_by_id.get(historia.get("pacienteId"), {})
        examen_general = historia.get("examenFisicoGeneral") or {}
        diagnostico = historia.get("diagnostico") or {}
        principal = diagnostico.get("principal") or {}
        secundarios = diagnostico.get("secundarios") or []
        diagnosticos = [
            label
            for item in [principal, *secundarios]
            if isinstance(item, dict)
            and (label := diagnosis_label(item))
        ]
        datos = paciente.get("datosPersonales") or {}

        rows.append(
            {
                "historiaId": historia.get("_id"),
                "pacienteId": historia.get("pacienteId"),
                "viajeId": historia.get("viajeId"),
                "genero": paciente.get("genero"),
                "fechaNacimiento": datos.get("fechaNacimiento"),
                "diagnosticoPrincipal": principal.get("title"),
                "diagnosticoCodigo": principal.get("code") or principal.get("iNo"),
                "diagnosticos": diagnosticos,
                "imc": examen_general.get("imc"),
                "diagnosticoIMC": examen_general.get("diagnosticoIMC"),
                "presionArterialMedia": examen_general.get("presionArterialMedia"),
                "frecuenciaCardiaca": examen_general.get("frecuenciaCardiaca"),
                "glicemiaCapilar": (historia.get("laboratorios") or {}).get("glicemiaCapilar"),
            }
        )
    return rows


def diagnosis_label(diagnosis: dict[str, Any]) -> str:
    return str(
        diagnosis.get("title")
        or diagnosis.get("code")
        or diagnosis.get("iNo")
        or ""
    ).strip()
