"use server";

import { getHistoriaClinicalSummaryData } from "@/components/historias/historia-clinical-summary-server";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import type { Historia } from "@/lib/schema/historia";
import { canAccessActiveStationHistoria } from "@/lib/station-histories";

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;

function isHistoriaDocument(doc: unknown): doc is HistoriaDocument {
  return typeof doc === "object" && doc !== null &&
    "type" in doc && doc.type === "historia" &&
    "_id" in doc && "_rev" in doc;
}

export async function getExamenGeneralSummary(historiaId: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Inicia sesión para consultar la historia.");

  const doc = await db.get(historiaId).catch(() => null);
  if (!isHistoriaDocument(doc) || !await canAccessActiveStationHistoria({
    historia: doc,
    stationKey: "examenFisicoGeneral",
    userId,
  })) {
    throw new Error("No se encontró la historia en tu viaje activo.");
  }

  const summary = await getHistoriaClinicalSummaryData(doc);
  return { historia: doc, ...summary };
}
