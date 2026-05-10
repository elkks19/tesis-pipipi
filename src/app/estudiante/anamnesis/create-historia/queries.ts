import "server-only";

import { db } from "@/lib/db";
import type { Paciente } from "@/lib/schema";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";

type PacienteDocument = Paciente & {
  _id?: string;
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

export async function searchPacientes(query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const result = await db.allDocs({
    include_docs: true,
  });

  return result.rows
    .map((row) => serializePaciente(row.doc as PacienteDocument))
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
