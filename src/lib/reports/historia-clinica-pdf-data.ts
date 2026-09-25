import "server-only";

import { db } from "@/lib/db";
import type {
  HistoriaClinicalPdfData,
  HistoriaDocument,
  PacienteDocument,
  RecetaDocument,
} from "@/lib/reports/historia-clinica-pdf";

function isHistoriaDocument(doc: unknown): doc is HistoriaDocument {
  return Boolean(
    doc &&
      typeof doc === "object" &&
      "_id" in doc &&
      "type" in doc &&
      doc.type === "historia",
  );
}

function isPacienteDocument(doc: unknown): doc is PacienteDocument {
  return Boolean(
    doc &&
      typeof doc === "object" &&
      "type" in doc &&
      doc.type === "paciente",
  );
}

function isRecetaDocument(doc: unknown): doc is RecetaDocument {
  return Boolean(
    doc &&
      typeof doc === "object" &&
      "type" in doc &&
      doc.type === "receta",
  );
}

export async function getHistoriaClinicalPdfData({
  generatedBy,
  historiaId,
}: {
  generatedBy: string;
  historiaId: string;
}): Promise<HistoriaClinicalPdfData | null> {
  const historia = await db.get(historiaId).catch(() => null);

  if (!isHistoriaDocument(historia)) {
    return null;
  }

  const [pacienteCandidate, recetaCandidate] = await Promise.all([
    db.get(historia.pacienteId).catch(() => null),
    historia.diagnostico?.recetaId
      ? db.get(historia.diagnostico.recetaId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    generatedBy,
    historia,
    paciente: isPacienteDocument(pacienteCandidate) ? pacienteCandidate : null,
    receta: isRecetaDocument(recetaCandidate) ? recetaCandidate : null,
  };
}
