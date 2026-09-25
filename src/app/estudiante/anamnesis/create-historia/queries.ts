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
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchPacientes(query: string, requestedPage = 1) {
  const trimmedQuery = query.trim();
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage : 1;
  const pageSize = 20;

  await ensureTesisIndexes();

  const terms = trimmedQuery.split(/\s+/).filter(Boolean).map((term) => {
    const accents: Record<string, string> = {
      a: "[aáàäâ]", e: "[eéèëê]", i: "[iíìïî]",
      o: "[oóòöô]", u: "[uúùüû]", n: "[nñ]",
    };
    const normalized = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return "(?i)" + [...normalized].map((char) => accents[char] ?? escapeRegex(char)).join("");
  });
  const result = await findTesisDocs({
    limit: pageSize + 1,
    skip: (page - 1) * pageSize,
    sort: [{ type: "asc" }, { _id: "asc" }],
    use_index: "idx_pacientes_listado",
    selector: {
      type: "paciente",
      ...(terms.length ? { $and: terms.map((term) => ({
        $or: [
          { "datosPersonales.numeroDocumentoIdentidad": { $regex: term } },
          { "datosPersonales.nombres": { $regex: term } },
          { "datosPersonales.apellidoPaterno": { $regex: term } },
          { "datosPersonales.apellidoMaterno": { $regex: term } },
        ],
      })) } : {}),
    },
  });

  const pacientes = result.docs.slice(0, pageSize)
    .map((doc) => serializePaciente(doc as PacienteDocument))
    .filter((paciente): paciente is PacienteSearchResult => Boolean(paciente));
  return { pacientes, page, pageSize, hasNext: result.docs.length > pageSize };
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

export async function getHistoriasByPacienteIds(ids: string[]) {
  const pacienteIds = [...new Set(ids.filter(Boolean))];

  if (pacienteIds.length === 0) {
    return {};
  }

  await ensureTesisIndexes();

  const result = await findTesisDocs({
    limit: pacienteIds.length * 12,
    selector: {
      pacienteId: { $in: pacienteIds },
      type: "historia",
    },
    use_index: "idx_historias_paciente",
  });
  const historiasByPacienteId: Record<string, HistoriaDocument[]> =
    Object.fromEntries(pacienteIds.map((id) => [id, []]));

  for (const doc of result.docs) {
    if (!isHistoriaDocument(doc) || !historiasByPacienteId[doc.pacienteId]) {
      continue;
    }

    if (historiasByPacienteId[doc.pacienteId].length < 12) {
      historiasByPacienteId[doc.pacienteId].push(doc);
    }
  }

  return historiasByPacienteId;
}
