import "server-only";

import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia, Paciente } from "@/lib/schema";
import type { Viaje } from "@/lib/schema/viajes";

const PAGE_SIZE = 10;

export const stationConfigs = {
  anamnesis: {
    field: "anamnesis",
    viajeTipo: "Anamnesis",
  },
  diagnostico: {
    field: "diagnostico",
    viajeTipo: "Diagnóstico",
  },
  ecografia: {
    complementaryKey: "ecografia",
    field: "ecografia",
    viajeTipo: "Ecografía",
  },
  electrocardiograma: {
    complementaryKey: "electrocardiograma",
    field: "electrocardiograma",
    viajeTipo: "Electrocardiograma",
  },
  espirometria: {
    complementaryKey: "espirometria",
    field: "espirometria",
    viajeTipo: "Espirometría",
  },
  examenFisicoGeneral: {
    field: "examenFisicoGeneral",
    viajeTipo: "Examen Físico General",
  },
  examenFisicoSegmentario: {
    field: "examenFisicoSegmentario",
    viajeTipo: "Examen Físico Segmentario",
  },
  laboratorios: {
    complementaryKey: "laboratorios",
    field: "laboratorios",
    viajeTipo: "Laboratorios",
  },
} as const;

export type StationKey = keyof typeof stationConfigs;

type HistoriaField = (typeof stationConfigs)[StationKey]["field"];

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;

type PacienteDocument = PouchDB.Core.ExistingDocument<Paciente>;

type ViajeDocument = PouchDB.Core.ExistingDocument<Viaje>;

export type StationHistoryRow = {
  historiaId: string;
  paciente: PacienteSearchResult;
};

export type StationHistoryPageResult = {
  hasNextPage: boolean;
  nextCursor?: string;
  pageSize: number;
  rows: StationHistoryRow[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dateToInputValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function serializePaciente(doc: PacienteDocument): PacienteSearchResult | null {
  if (!doc._id || doc.type !== "paciente") {
    return null;
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

function isHistoriaDocument(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia" &&
    "_id" in doc
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

function rowMatchesQuery(row: StationHistoryRow, query: string) {
  if (!query) {
    return true;
  }

  const datos = row.paciente.datosPersonales;
  const searchable = normalize(
    [
      datos.numeroDocumentoIdentidad,
      datos.nombres,
      datos.apellidoPaterno,
      datos.apellidoMaterno,
    ].join(" "),
  );

  return searchable.includes(query);
}

async function getPaciente(pacienteId: string) {
  try {
    const doc = (await db.get(pacienteId)) as PacienteDocument;

    return serializePaciente(doc);
  } catch {
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

export async function getAssignedViajeIds({
  mode,
  stationKey,
  userId,
}: {
  mode: "docente" | "estudiante";
  stationKey: StationKey;
  userId?: string;
}) {
  if (!userId) {
    return [];
  }

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
    limit: 500,
    selector: {
      estaciones: {
        $elemMatch: stationSelector,
      },
      type: "viaje",
    },
  });

  return result.docs
    .filter(isViajeDocument)
    .map((viaje) => viaje._id ?? viaje.id)
    .filter(Boolean);
}

function hasStationValue(doc: HistoriaDocument, field: HistoriaField) {
  return Boolean(doc[field]);
}

function isComplementaryRequested(doc: HistoriaDocument, stationKey: StationKey) {
  const config = stationConfigs[stationKey];

  if (!("complementaryKey" in config)) {
    return true;
  }

  return Boolean(doc.examenesComplementariosSolicitados?.[config.complementaryKey]);
}

async function isAssignedToStation({
  doc,
  mode,
  stationKey,
  userId,
  viajes,
}: {
  doc: HistoriaDocument;
  mode: "docente" | "estudiante";
  stationKey: StationKey;
  userId?: string;
  viajes: Map<string, ViajeDocument | null>;
}) {
  if (!userId || !doc.viajeId) {
    return mode === "estudiante";
  }

  const viaje = await getViaje(doc.viajeId, viajes);
  const estacion = viaje?.estaciones.find(
    (item) => item.tipo === stationConfigs[stationKey].viajeTipo,
  );

  if (!estacion) {
    return false;
  }

  if (mode === "docente") {
    return estacion.docenteEncargadoId === userId;
  }

  return estacion.estudiantesIds.includes(userId);
}

async function serializeHistoria({
  doc,
  mode,
  stationKey,
  userId,
  viajes,
}: {
  doc: HistoriaDocument;
  mode: "docente" | "estudiante";
  stationKey: StationKey;
  userId?: string;
  viajes: Map<string, ViajeDocument | null>;
}) {
  const config = stationConfigs[stationKey];
  const hasValue = hasStationValue(doc, config.field);

  if (!doc._id || doc.type !== "historia") {
    return null;
  }

  if (mode === "estudiante") {
    if (doc.diagnostico || hasValue || !isComplementaryRequested(doc, stationKey)) {
      return null;
    }
  } else if (!hasValue) {
    return null;
  }

  const isAssigned = await isAssignedToStation({
    doc,
    mode,
    stationKey,
    userId,
    viajes,
  });

  if (!isAssigned) {
    return null;
  }

  const paciente = await getPaciente(doc.pacienteId);

  if (!paciente) {
    return null;
  }

  return {
    historiaId: doc._id,
    paciente,
  };
}

export async function listStationHistories({
  cursor,
  mode,
  query,
  stationKey,
  userId,
}: {
  cursor?: string;
  mode: "docente" | "estudiante";
  query: string;
  stationKey: StationKey;
  userId?: string;
}): Promise<StationHistoryPageResult> {
  await ensureTesisIndexes();

  const normalizedQuery = normalize(query);
  const rows: StationHistoryRow[] = [];
  const viajes = new Map<string, ViajeDocument | null>();
  const assignedViajeIds = await getAssignedViajeIds({
    mode,
    stationKey,
    userId,
  });

  if (assignedViajeIds.length === 0) {
    return {
      hasNextPage: false,
      pageSize: PAGE_SIZE,
      rows: [],
    };
  }

  const config = stationConfigs[stationKey];
  const selector: Record<string, unknown> = {
    type: "historia",
    viajeId: {
      $in: assignedViajeIds,
    },
  };

  if (mode === "estudiante") {
    selector.diagnostico = { $exists: false };
    selector[config.field] = { $exists: false };

    if ("complementaryKey" in config) {
      selector[`examenesComplementariosSolicitados.${config.complementaryKey}`] =
        true;
    }
  } else {
    selector[config.field] = { $exists: true };
  }

  let reachedEnd = false;
  let bookmark = cursor || undefined;

  while (rows.length <= PAGE_SIZE && !reachedEnd) {
    const result = await findTesisDocs({
      bookmark,
      limit: PAGE_SIZE * 4,
      selector,
    });

    if (result.docs.length === 0) {
      reachedEnd = true;
      break;
    }

    bookmark = result.bookmark;

    for (const doc of result.docs) {

      if (!isHistoriaDocument(doc)) {
        continue;
      }

      const row = await serializeHistoria({
        doc,
        mode,
        stationKey,
        userId,
        viajes,
      });

      if (row && rowMatchesQuery(row, normalizedQuery)) {
        rows.push(row);
      }

      if (rows.length > PAGE_SIZE) {
        break;
      }
    }

    if (result.docs.length < PAGE_SIZE * 4 || !result.bookmark) {
      reachedEnd = true;
    }
  }

  const visibleRows = rows.slice(0, PAGE_SIZE);

  return {
    hasNextPage: rows.length > PAGE_SIZE,
    nextCursor: rows.length > PAGE_SIZE ? bookmark : undefined,
    pageSize: PAGE_SIZE,
    rows: visibleRows,
  };
}

export async function isDocenteEncargado({
  historia,
  stationKey,
  userId,
}: {
  historia: HistoriaDocument;
  stationKey: StationKey;
  userId: string;
}) {
  if (!historia.viajeId) {
    return false;
  }

  const viaje = await getViaje(historia.viajeId, new Map());
  const estacion = viaje?.estaciones.find(
    (item) => item.tipo === stationConfigs[stationKey].viajeTipo,
  );

  return estacion?.docenteEncargadoId === userId;
}
