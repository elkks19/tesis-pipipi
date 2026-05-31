from typing import Any

import httpx

INDEXES: list[dict[str, Any]] = [
    {
        "ddoc": "idx_type",
        "fields": ["type"],
        "name": "idx_type",
    },
    {
        "ddoc": "idx_viajes_fechas",
        "fields": ["type", "fechaEntrada", "fechaSalida"],
        "name": "idx_viajes_fechas",
    },
    {
        "ddoc": "idx_historias_viaje",
        "fields": ["type", "viajeId"],
        "name": "idx_historias_viaje",
    },
    {
        "ddoc": "idx_actividades_station_actor",
        "fields": ["type", "stationKey", "actorId"],
        "name": "idx_actividades_station_actor",
    },
    {
        "ddoc": "idx_actividades_station_actor_viaje",
        "fields": ["type", "stationKey", "actorId", "viajeId"],
        "name": "idx_actividades_station_actor_viaje",
    },
    {
        "ddoc": "idx_actividades_station_actor_viaje_created",
        "fields": ["type", "stationKey", "actorId", "viajeId", "createdAt"],
        "name": "idx_actividades_station_actor_viaje_created",
    },
    {
        "ddoc": "idx_actividades_station_viaje",
        "fields": ["type", "stationKey", "viajeId"],
        "name": "idx_actividades_station_viaje",
    },
    {
        "ddoc": "idx_actividades_station_viaje_created",
        "fields": ["type", "stationKey", "viajeId", "createdAt"],
        "name": "idx_actividades_station_viaje_created",
    },
    {
        "ddoc": "idx_pacientes_documento",
        "fields": ["type", "datosPersonales.numeroDocumentoIdentidad"],
        "name": "idx_pacientes_documento",
    },
    {
        "ddoc": "idx_pacientes_nombres",
        "fields": ["type", "datosPersonales.nombres"],
        "name": "idx_pacientes_nombres",
    },
    {
        "ddoc": "idx_pacientes_apellido_paterno",
        "fields": ["type", "datosPersonales.apellidoPaterno"],
        "name": "idx_pacientes_apellido_paterno",
    },
    {
        "ddoc": "idx_pacientes_apellido_materno",
        "fields": ["type", "datosPersonales.apellidoMaterno"],
        "name": "idx_pacientes_apellido_materno",
    },
    {
        "ddoc": "idx_investigacion_chats_owner_updated",
        "fields": ["type", "ownerId", "updatedAt"],
        "name": "idx_investigacion_chats_owner_updated",
    },
]


class CouchClient:
    def __init__(self, couchdb_url: str) -> None:
        self.couchdb_url = couchdb_url.rstrip("/")
        self._indexes_ready = False

    async def check(self) -> tuple[bool, str]:
        if not self.couchdb_url:
            return False, "COUCHDB_URL no esta configurado."
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(self.couchdb_url)
                response.raise_for_status()
            return True, "Conexion a CouchDB correcta."
        except Exception as exc:
            return False, str(exc)

    async def ensure_indexes(self) -> None:
        if self._indexes_ready:
            return
        if not self.couchdb_url:
            raise RuntimeError("COUCHDB_URL no esta configurado.")

        async with httpx.AsyncClient(timeout=60) as client:
            for index in INDEXES:
                response = await client.post(
                    f"{self.couchdb_url}/_index",
                    json={
                        "ddoc": index["ddoc"],
                        "index": {
                            "fields": index["fields"],
                        },
                        "name": index["name"],
                        "type": "json",
                    },
                )
                response.raise_for_status()

        self._indexes_ready = True

    async def find(
        self,
        selector: dict[str, Any],
        *,
        limit: int = 500,
        bookmark: str | None = None,
        use_index: str | list[str] | None = None,
    ) -> dict[str, Any]:
        if not self.couchdb_url:
            raise RuntimeError("COUCHDB_URL no esta configurado.")

        if use_index:
            await self.ensure_indexes()

        payload: dict[str, Any] = {
            "selector": selector,
            "limit": limit,
        }
        if bookmark:
            payload["bookmark"] = bookmark
        if use_index:
            payload["use_index"] = use_index

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(f"{self.couchdb_url}/_find", json=payload)
            if response.status_code == 400 and use_index:
                payload.pop("use_index", None)
                response = await client.post(f"{self.couchdb_url}/_find", json=payload)
            response.raise_for_status()
            return response.json()

    async def find_all(
        self,
        selector: dict[str, Any],
        *,
        limit: int = 500,
        use_index: str | list[str] | None = None,
    ) -> list[dict[str, Any]]:
        docs: list[dict[str, Any]] = []
        bookmark: str | None = None

        while True:
            result = await self.find(
                selector,
                limit=limit,
                bookmark=bookmark,
                use_index=use_index,
            )
            batch = result.get("docs", [])
            docs.extend(batch)
            next_bookmark = result.get("bookmark")
            if not batch or next_bookmark == bookmark:
                break
            bookmark = next_bookmark

        return docs

    async def get(self, doc_id: str) -> dict[str, Any] | None:
        if not self.couchdb_url:
            raise RuntimeError("COUCHDB_URL no esta configurado.")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{self.couchdb_url}/{doc_id}")
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()

    async def put(self, doc: dict[str, Any]) -> dict[str, Any]:
        if not self.couchdb_url:
            raise RuntimeError("COUCHDB_URL no esta configurado.")

        doc_id = doc.get("_id")
        if not doc_id:
            raise ValueError("El documento requiere _id.")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.put(f"{self.couchdb_url}/{doc_id}", json=doc)
            response.raise_for_status()
            return response.json()
