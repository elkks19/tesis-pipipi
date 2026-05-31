from typing import Any

from app.db.repositories import TesisRepository
from app.models.documents import RagChunk


def build_chunks(
    historias: list[dict[str, Any]],
    pacientes_by_id: dict[str, dict[str, Any]],
    viajes_by_id: dict[str, dict[str, Any]],
) -> list[RagChunk]:
    chunks: list[RagChunk] = []

    for historia in historias:
        historia_id = TesisRepository.doc_id(historia)
        paciente = pacientes_by_id.get(historia.get("pacienteId"), {})
        viaje = viajes_by_id.get(historia.get("viajeId"), {})
        title = build_title(historia, paciente, viaje)
        base_metadata = {
            "historiaId": historia_id,
            "pacienteId": historia.get("pacienteId"),
            "viajeId": historia.get("viajeId"),
        }

        for section_key, section_label in section_labels().items():
            section = historia.get(section_key)
            if not section:
                continue

            metadata = dict(base_metadata)
            metadata["section"] = section_key
            metadata["stationKey"] = section_to_station(section_key)
            text = "\n".join(
                [
                    f"Historia: {historia_id}",
                    f"Paciente: {patient_label(paciente)}",
                    f"Viaje: {trip_label(viaje)}",
                    f"Seccion: {section_label}",
                    flatten(section),
                ]
            )
            chunks.append(
                RagChunk(
                    chunk_id=f"{historia_id}:{section_key}",
                    document_id=historia_id,
                    document_type="historia",
                    title=f"{title} - {section_label}",
                    text=text,
                    metadata=metadata,
                )
            )

        summary_text = "\n".join(
            [
                f"Historia: {historia_id}",
                f"Paciente: {patient_label(paciente)}",
                f"Viaje: {trip_label(viaje)}",
                "Resumen estructural:",
                flatten({
                    "examenesComplementariosSolicitados": historia.get("examenesComplementariosSolicitados"),
                    "diagnostico": historia.get("diagnostico"),
                }),
            ]
        )
        chunks.append(
            RagChunk(
                chunk_id=f"{historia_id}:resumen",
                document_id=historia_id,
                document_type="historia",
                title=f"{title} - Resumen",
                text=summary_text,
                metadata={**base_metadata, "section": "resumen", "stationKey": None},
            )
        )

    return chunks


def build_title(historia: dict[str, Any], paciente: dict[str, Any], viaje: dict[str, Any]) -> str:
    historia_id = TesisRepository.doc_id(historia)
    return f"Historia {historia_id} ({patient_label(paciente)} / {trip_label(viaje)})"


def patient_label(paciente: dict[str, Any]) -> str:
    datos = paciente.get("datosPersonales") or {}
    nombres = " ".join(
        str(part)
        for part in [
            datos.get("nombres"),
            datos.get("apellidoPaterno"),
            datos.get("apellidoMaterno"),
        ]
        if part
    )
    return nombres or str(paciente.get("_id") or "paciente sin nombre")


def trip_label(viaje: dict[str, Any]) -> str:
    establecimiento = viaje.get("establecimiento") or {}
    return str(establecimiento.get("nombre") or viaje.get("servicio") or viaje.get("_id") or "viaje sin nombre")


def section_labels() -> dict[str, str]:
    return {
        "anamnesis": "Anamnesis",
        "examenFisicoGeneral": "Examen fisico general",
        "examenFisicoSegmentario": "Examen fisico segmentario",
        "electrocardiograma": "Electrocardiograma",
        "espirometria": "Espirometria",
        "ecografia": "Ecografia",
        "laboratorios": "Laboratorios",
        "diagnostico": "Diagnostico",
    }


def section_to_station(section: str) -> str:
    mapping = {
        "examenFisicoGeneral": "examen-fisico-general",
        "examenFisicoSegmentario": "examen-fisico-segmentario",
    }
    return mapping.get(section, section)


def flatten(value: Any, prefix: str = "") -> str:
    lines: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            child_text = flatten(child, child_prefix)
            if child_text:
                lines.append(child_text)
    elif isinstance(value, list):
        for index, child in enumerate(value, start=1):
            child_prefix = f"{prefix}[{index}]"
            child_text = flatten(child, child_prefix)
            if child_text:
                lines.append(child_text)
    elif value is not None and value != "":
        lines.append(f"{prefix}: {value}")
    return "\n".join(lines)
