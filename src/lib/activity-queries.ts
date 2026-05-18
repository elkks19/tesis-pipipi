import "server-only";

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
  mode,
  stationKey,
  userId,
}: {
  cursor?: string;
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
      hasNextPage: false,
      pageSize: PAGE_SIZE,
      rows: [],
    };
  }

  selector.viajeId = activeViajeId;

  if (mode === "estudiante") {
    selector.actorId = userId;
  }

  const result = await findTesisDocs({
    bookmark: cursor || undefined,
    limit: PAGE_SIZE + 1,
    selector,
  });

  for (const doc of result.docs) {
    if (isActivityDocument(doc)) {
      rows.push(doc);
    }
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const visibleRows = rows.slice(0, PAGE_SIZE);
  const usersById = getAuthUsersByIds(visibleRows.map((row) => row.actorId));
  const pacientes = new Map<string, PacienteDocument | null>();
  const historias = new Map<string, HistoriaDocument | null>();
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
    hasNextPage: rows.length > PAGE_SIZE,
    nextCursor: rows.length > PAGE_SIZE ? result.bookmark : undefined,
    pageSize: PAGE_SIZE,
    rows: hydratedRows,
  };
}
