from typing import Any

from app.db.couch import CouchClient


class TesisRepository:
    def __init__(self, couch: CouchClient) -> None:
        self.couch = couch

    async def fetch_historias(
        self,
        *,
        viaje_id: str | None = None,
        viaje_ids: list[str] | None = None,
        station_key: str | None = None,
        role: str | None = None,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        selected_viaje_ids = [item for item in (viaje_ids or []) if item]
        if not selected_viaje_ids and viaje_id:
            selected_viaje_ids = [viaje_id]

        selector: dict[str, Any] = {"type": "historia"}
        use_index: str | None = "idx_type"
        if len(selected_viaje_ids) == 1:
            selector["viajeId"] = selected_viaje_ids[0]
            use_index = "idx_historias_viaje"
        elif len(selected_viaje_ids) > 1:
            selector["viajeId"] = {"$in": selected_viaje_ids}
            use_index = "idx_historias_viaje"

        historias = await self.couch.find_all(selector, use_index=use_index)

        if len(selected_viaje_ids) > 1:
            selected = set(selected_viaje_ids)
            historias = [historia for historia in historias if historia.get("viajeId") in selected]

        if station_key:
            historias = [historia for historia in historias if self._has_station_data(historia, station_key)]

        if role == "estudiante" and user_id:
            historias = [
                historia
                for historia in historias
                if historia.get("created_by") == user_id
                or any(
                    isinstance(historia.get(section), dict)
                    and historia[section].get("created_by") == user_id
                    for section in self.station_sections()
                )
            ]

        return historias

    async def fetch_pacientes(self) -> list[dict[str, Any]]:
        return await self.couch.find_all({"type": "paciente"}, use_index="idx_type")

    async def fetch_viajes(self) -> list[dict[str, Any]]:
        return await self.couch.find_all({"type": "viaje"}, use_index="idx_type")

    async def fetch_actividades(self, viaje_id: str | None = None) -> list[dict[str, Any]]:
        selector: dict[str, Any] = {"type": "actividad"}
        use_index = "idx_type"
        if viaje_id:
            selector["viajeId"] = viaje_id
            use_index = "idx_actividades_station_viaje"
        return await self.couch.find_all(selector, use_index=use_index)

    async def fetch_pacientes_for_historias(
        self,
        historias: list[dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        pacientes = await self.fetch_pacientes()
        by_id = {self.doc_id(paciente): paciente for paciente in pacientes}
        return {
            historia.get("pacienteId"): by_id[historia.get("pacienteId")]
            for historia in historias
            if historia.get("pacienteId") in by_id
        }

    @staticmethod
    def doc_id(doc: dict[str, Any]) -> str:
        return str(doc.get("_id") or doc.get("id") or "")

    @staticmethod
    def station_sections() -> list[str]:
        return [
            "anamnesis",
            "examenFisicoGeneral",
            "examenFisicoSegmentario",
            "electrocardiograma",
            "espirometria",
            "ecografia",
            "laboratorios",
            "diagnostico",
        ]

    @staticmethod
    def _has_station_data(historia: dict[str, Any], station_key: str) -> bool:
        station_to_section = {
            "anamnesis": "anamnesis",
            "examen-fisico-general": "examenFisicoGeneral",
            "examen-fisico-segmentario": "examenFisicoSegmentario",
            "electrocardiograma": "electrocardiograma",
            "espirometria": "espirometria",
            "ecografia": "ecografia",
            "laboratorios": "laboratorios",
            "diagnostico": "diagnostico",
        }
        section = station_to_section.get(station_key, station_key)
        return bool(historia.get(section))
