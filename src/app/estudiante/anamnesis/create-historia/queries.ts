import "server-only";

import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { Paciente } from "@/lib/schema";
import type { Historia } from "@/lib/schema/historia";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";

type PacienteDocument = Paciente & {
  _id?: string;
};

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;

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
    "_id" in doc &&
    "_rev" in doc
  );
}

function pacienteMatchesQuery(paciente: PacienteSearchResult, query: string) {
  const normalizedQuery = normalize(query);
  const datos = paciente.datosPersonales;
  const searchable = normalize(
    [
      datos.numeroDocumentoIdentidad,
      datos.nombres,
      datos.apellidoPaterno,
      datos.apellidoMaterno,
    ].join(" "),
  );

  return searchable.includes(normalizedQuery);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchPacientes(query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  await ensureTesisIndexes();

  const safeQuery = escapeRegex(trimmedQuery);
  const result = await findTesisDocs({
    limit: 50,
    selector: {
      $or: [
        { "datosPersonales.numeroDocumentoIdentidad": { $regex: safeQuery } },
        { "datosPersonales.nombres": { $regex: safeQuery } },
        { "datosPersonales.apellidoPaterno": { $regex: safeQuery } },
        { "datosPersonales.apellidoMaterno": { $regex: safeQuery } },
      ],
      type: "paciente",
    },
  });

  return result.docs
    .map((doc) => serializePaciente(doc as PacienteDocument))
    .filter((paciente): paciente is PacienteSearchResult => Boolean(paciente))
    .filter((paciente) => pacienteMatchesQuery(paciente, trimmedQuery))
    .slice(0, 25);
}

export async function getPacienteById(id: string) {
  if (!id) {
    return null;
  }

  try {
    const doc = (await db.get(id)) as PacienteDocument;

    return serializePaciente(doc);
  } catch {
    return null;
  }
}

export async function getHistoriasByPacienteId(id: string) {
  if (!id) {
    return [];
  }

  await ensureTesisIndexes();

  const result = await findTesisDocs({
    limit: 25,
    selector: {
      pacienteId: id,
      type: "historia",
    },
    use_index: "idx_historias_paciente",
  });

  return result.docs.filter(isHistoriaDocument).slice(0, 12);
}
