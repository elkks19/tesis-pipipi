import "server-only";

import { db } from "@/lib/db";

type IndexDefinition = {
  ddoc: string;
  fields: string[];
  name: string;
};

const indexes: IndexDefinition[] = [
  {
    ddoc: "idx_type",
    fields: ["type"],
    name: "idx_type",
  },
  {
    ddoc: "idx_viajes_fechas",
    fields: ["type", "fechaEntrada", "fechaSalida"],
    name: "idx_viajes_fechas",
  },
  {
    ddoc: "idx_historias_viaje",
    fields: ["type", "viajeId"],
    name: "idx_historias_viaje",
  },
  {
    ddoc: "idx_historias_paciente",
    fields: ["type", "pacienteId"],
    name: "idx_historias_paciente",
  },
  {
    ddoc: "idx_viaje_inventario_viaje",
    fields: ["type", "viajeId"],
    name: "idx_viaje_inventario_viaje",
  },
  {
    ddoc: "idx_recetas_historia",
    fields: ["type", "historiaId"],
    name: "idx_recetas_historia",
  },
  {
    ddoc: "idx_medicamento_catalogo_fuente",
    fields: ["type", "fuente"],
    name: "idx_medicamento_catalogo_fuente",
  },
  {
    ddoc: "idx_actividades_station_actor",
    fields: ["type", "stationKey", "actorId"],
    name: "idx_actividades_station_actor",
  },
  {
    ddoc: "idx_actividades_station_actor_viaje",
    fields: ["type", "stationKey", "actorId", "viajeId"],
    name: "idx_actividades_station_actor_viaje",
  },
  {
    ddoc: "idx_actividades_station_actor_viaje_created",
    fields: ["type", "stationKey", "actorId", "viajeId", "createdAt"],
    name: "idx_actividades_station_actor_viaje_created",
  },
  {
    ddoc: "idx_actividades_station_viaje",
    fields: ["type", "stationKey", "viajeId"],
    name: "idx_actividades_station_viaje",
  },
  {
    ddoc: "idx_actividades_station_viaje_created",
    fields: ["type", "stationKey", "viajeId", "createdAt"],
    name: "idx_actividades_station_viaje_created",
  },
  {
    ddoc: "idx_actividades_viaje_created",
    fields: ["type", "viajeId", "createdAt"],
    name: "idx_actividades_viaje_created",
  },
  {
    ddoc: "idx_actividades_viaje_actor_created",
    fields: ["type", "viajeId", "actorId", "createdAt"],
    name: "idx_actividades_viaje_actor_created",
  },
  {
    ddoc: "idx_pacientes_documento",
    fields: ["type", "datosPersonales.numeroDocumentoIdentidad"],
    name: "idx_pacientes_documento",
  },
  {
    ddoc: "idx_pacientes_nombres",
    fields: ["type", "datosPersonales.nombres"],
    name: "idx_pacientes_nombres",
  },
  {
    ddoc: "idx_pacientes_apellido_paterno",
    fields: ["type", "datosPersonales.apellidoPaterno"],
    name: "idx_pacientes_apellido_paterno",
  },
  {
    ddoc: "idx_pacientes_apellido_materno",
    fields: ["type", "datosPersonales.apellidoMaterno"],
    name: "idx_pacientes_apellido_materno",
  },
];

let indexesPromise: Promise<void> | null = null;

export function ensureTesisIndexes() {
  indexesPromise ??= Promise.all(
    indexes.map((index) =>
      db.createIndex({
        index: {
          ddoc: index.ddoc,
          fields: index.fields,
          name: index.name,
        },
      }),
    ),
  ).then(() => undefined);

  return indexesPromise;
}
