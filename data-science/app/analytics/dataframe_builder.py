from datetime import date
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
                "edad": age_from_birthdate(datos.get("fechaNacimiento")),
                "grupoEdad": age_group(datos.get("fechaNacimiento")),
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


def age_from_birthdate(value: Any) -> int | None:
    if not value:
        return None

    try:
        birthdate = date.fromisoformat(str(value)[:10])
    except ValueError:
        return None

    today = date.today()
    age = today.year - birthdate.year
    if (today.month, today.day) < (birthdate.month, birthdate.day):
        age -= 1

    return age if age >= 0 else None


def age_group(value: Any) -> str:
    age = age_from_birthdate(value)
    if age is None:
        return "Sin dato"
    if age < 5:
        return "0-4"
    if age < 12:
        return "5-11"
    if age < 18:
        return "12-17"
    if age < 30:
        return "18-29"
    if age < 45:
        return "30-44"
    if age < 60:
        return "45-59"
    return "60+"


def diagnosis_label(diagnosis: dict[str, Any]) -> str:
    return str(
        diagnosis.get("title")
        or diagnosis.get("code")
        or diagnosis.get("iNo")
        or ""
    ).strip()
