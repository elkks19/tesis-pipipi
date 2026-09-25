import "server-only";
import { paginateActivity } from "@/lib/activity-pagination";

import { getAuthUsersByIds } from "@/lib/auth-users";
import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { Actividad } from "@/lib/schema/actividad";
import type { ActividadChange } from "@/lib/schema/actividad";
import type { Historia } from "@/lib/schema/historia";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Paciente } from "@/lib/schema/pacientes";
import type { Viaje } from "@/lib/schema/viajes";
import {
  stationConfigs,
  type StationKey,
} from "@/lib/station-histories";

const PAGE_SIZE = 15;

type ActivityDocument = PouchDB.Core.ExistingDocument<Actividad>;

type PacienteDocument = PouchDB.Core.ExistingDocument<Paciente>;

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;

type ViajeDocument = PouchDB.Core.ExistingDocument<Viaje>;

export type ActivityListItem = {
  action: Actividad["action"];
  actorEmail?: string;
  actorId: string;
  actorName: string;
  changes: ActividadChange[];
  changedFields: string[];
  createdAt: string;
  historiaId?: string;
  historia?: Historia;
  id: string;
  paciente?: PacienteSearchResult;
  pacienteDocument: string;
  pacienteId: string;
  pacienteName: string;
  stationKey: StationKey;
  subject: Actividad["subject"];
  viajeId: string;
};

export type ActivityPageResult = {
  page: number;
  total: number;
  totalPages: number;
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

function isHistoriaDocument(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia"
  );
}

function isViajeDocument(doc: unknown): doc is ViajeDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viaje" &&
    "fechaEntrada" in doc &&
    "fechaSalida" in doc &&
    "estaciones" in doc &&
    Array.isArray(doc.estaciones)
  );
}

function getTodayValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/La_Paz",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${value.year}-${value.month}-${value.day}`;
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

function dateToInputValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function serializePaciente(doc: PacienteDocument | null): PacienteSearchResult | undefined {
  if (!doc?._id || doc.type !== "paciente") {
    return undefined;
  }

  return {
    id: doc._id,
    datosPersonales: {
      ...doc.datosPersonales,
      fechaNacimiento: dateToInputValue(doc.datosPersonales.fechaNacimiento),
    },
    genero: doc.genero,
    lugarNacimiento: doc.lugarNacimiento,
    nacionalidad: doc.nacionalidad,
    etnia: doc.etnia,
    padres: doc.padres?.map((padre) => ({
      ...padre,
      datosPersonales: {
        ...padre.datosPersonales,
        fechaNacimiento: dateToInputValue(
          padre.datosPersonales.fechaNacimiento,
        ),
      },
    })),
  };
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

async function getHistoria(
  historiaId: string | undefined,
  cache: Map<string, HistoriaDocument | null>,
) {
  if (!historiaId) {
    return null;
  }

  if (cache.has(historiaId)) {
    return cache.get(historiaId) ?? null;
  }

  try {
    const doc = await db.get(historiaId);
    const historia = isHistoriaDocument(doc) ? doc : null;
    cache.set(historiaId, historia);

    return historia;
  } catch {
    cache.set(historiaId, null);
    return null;
  }
}

async function getActiveViajeId({
  mode,
  stationKey,
  userId,
}: {
  mode: "docente" | "estudiante";
  stationKey: StationKey;
  userId: string;
}) {
  const today = getTodayValue();
  const stationSelector =
    mode === "docente"
      ? {
          docenteEncargadoId: userId,
          tipo: stationConfigs[stationKey].viajeTipo,
        }
      : {
          estudiantesIds: {
            $elemMatch: {
              $eq: userId,
            },
          },
          tipo: stationConfigs[stationKey].viajeTipo,
        };
  const result = await findTesisDocs({
    limit: 10,
    selector: {
      fechaEntrada: {
        $lte: today,
      },
      fechaSalida: {
        $gte: today,
      },
      estaciones: {
        $elemMatch: stationSelector,
      },
      type: "viaje",
    },
  });
  const activeTrips = result.docs
    .filter(isViajeDocument)
    .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada));

  return activeTrips[0]?._id ?? activeTrips[0]?.id;
}

export async function listActivity({
  cursor,
  page = 1,
  query = "",
  mode,
  stationKey,
  userId,
}: {
  cursor?: string;
  page?: number;
  query?: string;
  mode: "docente" | "estudiante";
  stationKey: StationKey;
  userId: string;
}): Promise<ActivityPageResult> {
  await ensureTesisIndexes();

  const rows: ActivityDocument[] = [];
  const selector: Record<string, unknown> = {
    stationKey,
    type: "actividad",
  };
  const activeViajeId = await getActiveViajeId({
    mode,
    stationKey,
    userId,
  });

  if (!activeViajeId) {
    return {
      page: 1,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      pageSize: PAGE_SIZE,
      rows: [],
    };
  }

  selector.viajeId = activeViajeId;

  if (mode === "estudiante") {
    selector.actorId = userId;
  }

  // Read the authorized trip/station before sorting: sorting a limited Mango
  // result only orders that arbitrary subset and can hide recent events.
  for (let skip = 0; ; skip += 500) {
    const result = await findTesisDocs({ limit: 500, skip, selector });
    rows.push(...result.docs.filter(isActivityDocument));
    if (result.docs.length < 500) break;
  }

  const usersById = getAuthUsersByIds(rows.map((row) => row.actorId));
  const pacientes = new Map<string, PacienteDocument | null>();
  const historias = new Map<string, HistoriaDocument | null>();
  if (query.trim()) {
    const ids = [...new Set(rows.map((row) => row.pacienteId))];
    for (let offset = 0; offset < ids.length; offset += 25) {
      await Promise.all(ids.slice(offset, offset + 25).map((id) => getPaciente(id, pacientes)));
    }
  }
  const selected = paginateActivity(rows.map((row) => ({
    ...row,
    id: row._id,
    searchText: [getPacienteName(pacientes.get(row.pacienteId) ?? null), getPacienteDocument(pacientes.get(row.pacienteId) ?? null), usersById.get(row.actorId)?.name, row.subject === "paciente" ? "Paciente" : "Registro", row.action === "created" ? "creado" : "actualizado editado", row.createdAt].join(" "),
  })), cursor ? Number(cursor) : page, query, PAGE_SIZE);
  const visibleRows = selected.rows;
  const hydratedRows = await Promise.all(
    visibleRows.map(async (row) => {
      const [paciente, historia] = await Promise.all([
        getPaciente(row.pacienteId, pacientes),
        getHistoria(row.historiaId, historias),
      ]);
      const actor = usersById.get(row.actorId);

      return {
        action: row.action,
        actorEmail: actor?.email,
        actorId: row.actorId,
        actorName: actor?.name ?? "Usuario no encontrado",
        changes: row.changes ?? [],
        changedFields: row.changedFields,
        createdAt: row.createdAt,
        historia: historia ?? undefined,
        historiaId: row.historiaId,
        id: row._id ?? "",
        paciente: serializePaciente(paciente),
        pacienteDocument: getPacienteDocument(paciente),
        pacienteId: row.pacienteId,
        pacienteName: getPacienteName(paciente),
        stationKey: row.stationKey,
        subject: row.subject,
        viajeId: row.viajeId,
      };
    }),
  );
  return {
    page: selected.page,
    total: selected.total,
    totalPages: selected.totalPages,
    hasNextPage: selected.page < selected.totalPages,
    nextCursor: selected.page < selected.totalPages ? String(selected.page + 1) : undefined,
    pageSize: PAGE_SIZE,
    rows: hydratedRows,
  };
}
