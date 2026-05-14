import "server-only";

import { getAuthUsersByIds } from "@/lib/auth-users";
import { db } from "@/lib/db";
import type { Actividad } from "@/lib/schema/actividad";
import type { Paciente } from "@/lib/schema/pacientes";
import type { Viaje } from "@/lib/schema/viajes";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

const PAGE_SIZE = 15;
const ACTIVITY_ID_PREFIX = "actividad:";
const ACTIVITY_ID_END = "actividad:\ufff0";

type ActivityDocument = Actividad & {
  _id?: string;
};

type PacienteDocument = Paciente & {
  _id?: string;
};

type ViajeDocument = Viaje & {
  _id?: string;
};

export type ActivityListItem = {
  action: Actividad["action"];
  actorEmail?: string;
  actorId: string;
  actorName: string;
  changedFields: string[];
  createdAt: string;
  historiaId?: string;
  id: string;
  pacienteDocument: string;
  pacienteId: string;
  pacienteName: string;
  stationKey: StationKey;
  subject: Actividad["subject"];
  viajeId: string;
};

export type ActivityPageResult = {
  hasNextPage: boolean;
  nextCursor?: string;
  pageSize: number;
  rows: ActivityListItem[];
};

function isActivityDocument(doc: unknown): doc is ActivityDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "actividad" &&
    "_id" in doc
  );
}

function isPacienteDocument(doc: unknown): doc is PacienteDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente"
  );
}

function isViajeDocument(doc: unknown): doc is ViajeDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viaje" &&
    "estaciones" in doc &&
    Array.isArray(doc.estaciones)
  );
}

function getPacienteName(paciente: PacienteDocument | null) {
  if (!paciente) {
    return "Paciente no encontrado";
  }

  const { nombres, apellidoPaterno, apellidoMaterno } =
    paciente.datosPersonales;

  return [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ");
}

function getPacienteDocument(paciente: PacienteDocument | null) {
  if (!paciente) {
    return "Sin documento";
  }

  const datos = paciente.datosPersonales;

  return `${datos.documentoIdentidad} ${datos.numeroDocumentoIdentidad}`;
}

async function getPaciente(
  pacienteId: string,
  cache: Map<string, PacienteDocument | null>,
) {
  if (cache.has(pacienteId)) {
    return cache.get(pacienteId) ?? null;
  }

  try {
    const doc = await db.get(pacienteId);
    const paciente = isPacienteDocument(doc) ? doc : null;
    cache.set(pacienteId, paciente);

    return paciente;
  } catch {
    cache.set(pacienteId, null);
    return null;
  }
}

async function getViaje(viajeId: string, cache: Map<string, ViajeDocument | null>) {
  if (cache.has(viajeId)) {
    return cache.get(viajeId) ?? null;
  }

  try {
    const doc = await db.get(viajeId);
    const viaje = isViajeDocument(doc) ? doc : null;
    cache.set(viajeId, viaje);

    return viaje;
  } catch {
    cache.set(viajeId, null);
    return null;
  }
}

async function canSeeActivity({
  activity,
  mode,
  userId,
  viajes,
}: {
  activity: ActivityDocument;
  mode: "docente" | "estudiante";
  userId: string;
  viajes: Map<string, ViajeDocument | null>;
}) {
  if (mode === "estudiante") {
    return activity.actorId === userId;
  }

  const viaje = await getViaje(activity.viajeId, viajes);
  const estacion = viaje?.estaciones.find(
    (item) => item.tipo === stationConfigs[activity.stationKey].viajeTipo,
  );

  return estacion?.docenteEncargadoId === userId;
}

export async function listActivity({
  cursor,
  mode,
  stationKey,
  userId,
}: {
  cursor?: string;
  mode: "docente" | "estudiante";
  stationKey: StationKey;
  userId: string;
}): Promise<ActivityPageResult> {
  const rows: ActivityDocument[] = [];
  const viajes = new Map<string, ViajeDocument | null>();
  let nextStartKey = cursor || ACTIVITY_ID_END;
  let shouldSkipCursor = Boolean(cursor);
  let reachedEnd = false;

  while (rows.length <= PAGE_SIZE && !reachedEnd) {
    const result = await db.allDocs({
      descending: true,
      endkey: ACTIVITY_ID_PREFIX,
      include_docs: true,
      limit: 100,
      skip: shouldSkipCursor ? 1 : 0,
      startkey: nextStartKey,
    });

    if (result.rows.length === 0) {
      reachedEnd = true;
      break;
    }

    shouldSkipCursor = true;
    nextStartKey = result.rows[result.rows.length - 1].id;

    for (const resultRow of result.rows) {
      const doc = resultRow.doc;

      if (!isActivityDocument(doc) || doc.stationKey !== stationKey) {
        continue;
      }

      if (
        await canSeeActivity({
          activity: doc,
          mode,
          userId,
          viajes,
        })
      ) {
        rows.push(doc);
      }

      if (rows.length > PAGE_SIZE) {
        break;
      }
    }

    if (result.rows.length < 100) {
      reachedEnd = true;
    }
  }

  const visibleRows = rows.slice(0, PAGE_SIZE);
  const usersById = getAuthUsersByIds(visibleRows.map((row) => row.actorId));
  const pacientes = new Map<string, PacienteDocument | null>();
  const hydratedRows = await Promise.all(
    visibleRows.map(async (row) => {
      const paciente = await getPaciente(row.pacienteId, pacientes);
      const actor = usersById.get(row.actorId);

      return {
        action: row.action,
        actorEmail: actor?.email,
        actorId: row.actorId,
        actorName: actor?.name ?? "Usuario no encontrado",
        changedFields: row.changedFields,
        createdAt: row.createdAt,
        historiaId: row.historiaId,
        id: row._id ?? "",
        pacienteDocument: getPacienteDocument(paciente),
        pacienteId: row.pacienteId,
        pacienteName: getPacienteName(paciente),
        stationKey: row.stationKey,
        subject: row.subject,
        viajeId: row.viajeId,
      };
    }),
  );
  const lastVisibleRow = visibleRows.at(-1);

  return {
    hasNextPage: rows.length > PAGE_SIZE,
    nextCursor:
      rows.length > PAGE_SIZE && lastVisibleRow ? lastVisibleRow._id : undefined,
    pageSize: PAGE_SIZE,
    rows: hydratedRows,
  };
}
