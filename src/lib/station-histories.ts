import "server-only";

import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia, Paciente } from "@/lib/schema";
import type { Viaje } from "@/lib/schema/viajes";

const PAGE_SIZE = 10;
const HISTORY_FIND_BATCH_SIZE = 50;
const PATIENT_READ_BATCH_SIZE = 10;

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
  farmacia: {
    field: "receta",
    viajeTipo: "Farmacia",
  },
} as const;

export type StationKey = keyof typeof stationConfigs;

type HistoriaField = (typeof stationConfigs)[StationKey]["field"];

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;

type PacienteDocument = PouchDB.Core.ExistingDocument<Paciente>;

type ViajeDocument = PouchDB.Core.ExistingDocument<Viaje>;

export type StationHistoryRow = {
  createdAt?: string;
  hasClinicalDetail: boolean;
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

function isActiveViaje(viaje: ViajeDocument, today = getTodayValue()) {
  return viaje.fechaEntrada <= today && viaje.fechaSalida >= today;
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

  await ensureTesisIndexes();

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

export async function getActiveAssignedViajeIds({
  mode,
  stationKey,
  userId,
}: {
  mode: "docente" | "estudiante";
  stationKey: StationKey;
  userId?: string;
}) {
  const viajeIds = await getAssignedViajeIds({ mode, stationKey, userId });

  if (viajeIds.length === 0) {
    return [];
  }

  const viajeCache = new Map<string, ViajeDocument | null>();
  const viajes = await Promise.all(
    viajeIds.map((viajeId) => getViaje(viajeId, viajeCache)),
  );

  return viajes
    .filter((viaje): viaje is ViajeDocument => Boolean(viaje))
    .filter((viaje) => isActiveViaje(viaje))
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

  return doc.examenesComplementariosSolicitados?.[config.complementaryKey] === true;
}

async function serializeHistoria({
  doc,
  includeCompleted,
  mode,
  stationKey,
}: {
  doc: HistoriaDocument;
  includeCompleted: boolean;
  mode: "docente" | "estudiante";
  stationKey: StationKey;
}) {
  const config = stationConfigs[stationKey];
  const hasValue = hasStationValue(doc, config.field);

  if (!doc._id || doc.type !== "historia") {
    return null;
  }

  if (mode === "estudiante") {
    if ((!includeCompleted && hasValue) || (doc.diagnostico && !hasValue) || !isComplementaryRequested(doc, stationKey)) {
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
    createdAt: doc.createdAt,
    hasClinicalDetail: Boolean(
      doc.anamnesis || doc.examenFisicoGeneral || doc.examenFisicoSegmentario ||
      doc.laboratorios || doc.electrocardiograma || doc.espirometria ||
      doc.ecografia || doc.diagnostico,
    ),
    historiaId: doc._id,
    paciente,
    stationCompleted: hasValue,
  };
}

export async function listStationHistories({
  cursor,
  includeCompleted = false,
  mode,
  newestFirst = false,
  query,
  stationKey,
  userId,
}: {
  cursor?: string;
  includeCompleted?: boolean;
  mode: "docente" | "estudiante";
  newestFirst?: boolean;
  query: string;
  stationKey: StationKey;
  userId?: string;
}): Promise<StationHistoryPageResult> {
  const normalizedQuery = normalize(query);
  const rows: StationHistoryRow[] = [];
  const startIndex = Number.parseInt(cursor ?? "0", 10);
  const offset = Number.isFinite(startIndex) && startIndex > 0 ? startIndex : 0;
  const requiredRows = offset + PAGE_SIZE + 1;
  await ensureTesisIndexes();

  const scopeToActiveViaje = mode === "docente" || userId !== undefined;
  const activeViajeIds = scopeToActiveViaje
    ? await getActiveAssignedViajeIds({ mode, stationKey, userId })
    : [];

  if (scopeToActiveViaje && activeViajeIds.length === 0) {
    return {
      hasNextPage: false,
      pageSize: PAGE_SIZE,
      rows: [],
    };
  }

  const historySelector: Record<string, unknown> = {
    type: "historia",
  };
  if (newestFirst) {
    historySelector.createdAt = { $exists: true };
  }
  if (activeViajeIds.length === 1) {
    historySelector.viajeId = activeViajeIds[0];
  } else if (activeViajeIds.length > 1) {
    historySelector.viajeId = {
      $in: activeViajeIds,
    };
  }

  async function collectRows(
    selector: Record<string, unknown>,
    useIndex: string,
    sort?: unknown[],
  ) {
    let pageBookmark: string | undefined;
    do {
      const result = await findTesisDocs({
        bookmark: pageBookmark,
        limit: HISTORY_FIND_BATCH_SIZE,
        selector,
        ...(sort ? { sort } : {}),
        use_index: useIndex,
      });
      pageBookmark = result.bookmark;

      for (let index = 0; index < result.docs.length; index += PATIENT_READ_BATCH_SIZE) {
        const batch = result.docs
          .slice(index, index + PATIENT_READ_BATCH_SIZE)
          .filter(isHistoriaDocument);
        const batchRows = await Promise.all(batch.map((doc) =>
          serializeHistoria({ doc, includeCompleted, mode, stationKey }),
        ));

        for (const row of batchRows) {
          if (row && rowMatchesQuery(row, normalizedQuery)) {
            rows.push(row);
            if (rows.length >= requiredRows) break;
          }
        }
        if (rows.length >= requiredRows) break;
      }

      if (rows.length >= requiredRows || result.docs.length < HISTORY_FIND_BATCH_SIZE) break;
    } while (pageBookmark);
  }

  await collectRows(
    historySelector,
    newestFirst ? "idx_historias_fecha" : activeViajeIds.length > 0 ? "idx_historias_viaje" : "idx_type",
    newestFirst ? [{ type: "desc" }, { createdAt: "desc" }] : undefined,
  );

  if (newestFirst && rows.length < requiredRows) {
    await collectRows(
      { ...historySelector, createdAt: { $exists: false } },
      activeViajeIds.length > 0 ? "idx_historias_viaje" : "idx_type",
    );
  }

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

  return Boolean(
    viaje &&
      isActiveViaje(viaje) &&
      estacion?.docenteEncargadoId === userId,
  );
}

export async function canAccessActiveStationHistoria({
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

  if (!viaje || !isActiveViaje(viaje)) {
    return false;
  }

  const estacion = viaje.estaciones.find(
    (item) => item.tipo === stationConfigs[stationKey].viajeTipo,
  );

  return Boolean(
    estacion?.docenteEncargadoId === userId ||
      estacion?.estudiantesIds.includes(userId),
  );
}
