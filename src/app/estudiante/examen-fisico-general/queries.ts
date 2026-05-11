import "server-only";

import { db } from "@/lib/db";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia, Paciente } from "@/lib/schema";

const PAGE_SIZE = 10;
const SCAN_BATCH_SIZE = 100;
const HISTORIA_ID_PREFIX = "historia:";
const HISTORIA_ID_END = "historia:\ufff0";

type HistoriaDocument = Historia & {
  _id?: string;
};

type PacienteDocument = Paciente & {
  _id?: string;
};

export type ExamenFisicoGeneralRow = {
  examenFisicoGeneralCompleto: boolean;
  historiaId: string;
  paciente: PacienteSearchResult;
};

export type ExamenFisicoGeneralPageResult = {
  hasNextPage: boolean;
  nextCursor?: string;
  pageSize: number;
  rows: ExamenFisicoGeneralRow[];
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

function rowMatchesQuery(row: ExamenFisicoGeneralRow, query: string) {
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

async function serializeHistoria(doc: HistoriaDocument) {
  if (!doc._id || doc.type !== "historia") {
    return null;
  }

  const paciente = await getPaciente(doc.pacienteId);

  if (!paciente) {
    return null;
  }

  return {
    examenFisicoGeneralCompleto: Boolean(doc.examenFisicoGeneral),
    historiaId: doc._id,
    paciente,
  };
}

export async function listHistoriasForExamenFisicoGeneral({
  cursor,
  query,
}: {
  cursor?: string;
  query: string;
}): Promise<ExamenFisicoGeneralPageResult> {
  const normalizedQuery = normalize(query);
  const rows: ExamenFisicoGeneralRow[] = [];
  let nextScanStartKey = cursor || HISTORIA_ID_PREFIX;
  let shouldSkipCursor = Boolean(cursor);
  let reachedEnd = false;

  while (rows.length <= PAGE_SIZE && !reachedEnd) {
    const result = await db.allDocs({
      endkey: HISTORIA_ID_END,
      include_docs: true,
      limit: SCAN_BATCH_SIZE,
      skip: shouldSkipCursor ? 1 : 0,
      startkey: nextScanStartKey,
    });

    if (result.rows.length === 0) {
      reachedEnd = true;
      break;
    }

    shouldSkipCursor = true;
    nextScanStartKey = result.rows[result.rows.length - 1].id;

    for (const resultRow of result.rows) {
      const doc = resultRow.doc;

      if (!isHistoriaDocument(doc)) {
        continue;
      }

      const row = await serializeHistoria(doc);

      if (row && rowMatchesQuery(row, normalizedQuery)) {
        rows.push(row);
      }

      if (rows.length > PAGE_SIZE) {
        break;
      }
    }

    if (result.rows.length < SCAN_BATCH_SIZE) {
      reachedEnd = true;
    }
  }

  const visibleRows = rows.slice(0, PAGE_SIZE);
  const lastVisibleRow = visibleRows.at(-1);

  return {
    hasNextPage: rows.length > PAGE_SIZE,
    nextCursor:
      rows.length > PAGE_SIZE && lastVisibleRow
        ? lastVisibleRow.historiaId
        : undefined,
    pageSize: PAGE_SIZE,
    rows: visibleRows,
  };
}
