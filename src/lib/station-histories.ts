import "server-only";

import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia, Paciente } from "@/lib/schema";
import type { Viaje } from "@/lib/schema/viajes";

const PAGE_SIZE = 10;
const HISTORY_FIND_BATCH_SIZE = 500;

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
  stationCompleted: boolean;
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

async function serializeHistoria({
  doc,
  mode,
  stationKey,
}: {
  doc: HistoriaDocument;
  mode: "docente" | "estudiante";
  stationKey: StationKey;
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
  } else if (!isComplementaryRequested(doc, stationKey)) {
    return null;
  }

  const paciente = await getPaciente(doc.pacienteId);

  if (!paciente) {
    return null;
  }

  return {
    historiaId: doc._id,
    paciente,
    stationCompleted: hasValue,
  };
}

export async function listStationHistories({
  cursor,
  mode,
  query,
  stationKey,
}: {
  cursor?: string;
  mode: "docente" | "estudiante";
  query: string;
  stationKey: StationKey;
  userId?: string;
}): Promise<StationHistoryPageResult> {
  const normalizedQuery = normalize(query);
  const rows: StationHistoryRow[] = [];
  const startIndex = Number.parseInt(cursor ?? "0", 10);
  const offset = Number.isFinite(startIndex) && startIndex > 0 ? startIndex : 0;
  let bookmark: string | undefined;

  await ensureTesisIndexes();

  do {
    const result = await findTesisDocs({
      bookmark,
      limit: HISTORY_FIND_BATCH_SIZE,
      selector: {
        type: "historia",
      },
      use_index: "idx_type",
    });

    bookmark = result.bookmark;

    for (const doc of result.docs) {
      if (!isHistoriaDocument(doc)) {
        continue;
      }

      const row = await serializeHistoria({
        doc,
        mode,
        stationKey,
      });

      if (row && rowMatchesQuery(row, normalizedQuery)) {
        rows.push(row);
      }
    }

    if (result.docs.length < HISTORY_FIND_BATCH_SIZE) {
      break;
    }
  } while (bookmark);

  const visibleRows = rows.slice(offset, offset + PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;

  return {
    hasNextPage: nextOffset < rows.length,
    nextCursor: nextOffset < rows.length ? String(nextOffset) : undefined,
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
