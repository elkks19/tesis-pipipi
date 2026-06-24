import "server-only";

import { db } from "@/lib/db";
import type { Historia } from "@/lib/schema/historia";
import {
  canAccessActiveStationHistoria,
  type StationKey,
} from "@/lib/station-histories";

export type HistoriaDocument = Historia & {
  _id?: string;
};

export function isHistoria(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia"
  );
}

export function numberToString(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

export async function getHistoria(
  idHistoria: string,
  options?: {
    stationKey?: StationKey;
    userId?: string;
  },
) {
  try {
    const doc = await db.get(idHistoria);

    if (!isHistoria(doc)) {
      return null;
    }

    if (options?.stationKey) {
      if (!options.userId) {
        return null;
      }

      const canAccess = await canAccessActiveStationHistoria({
        historia: doc,
        stationKey: options.stationKey,
        userId: options.userId,
      });

      if (!canAccess) {
        return null;
      }
    }

    return doc;
  } catch {
    return null;
  }
}
