import "server-only";

import { db } from "@/lib/db";
import type { Viaje } from "@/lib/schema/viajes";

export type ViajeListItem = Viaje & {
  docId: string;
};

type ViajeDocument = Viaje & {
  _id?: string;
};

type ViajeFilters = {
  fechaDesde?: string;
  fechaHasta?: string;
  lugar?: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isViaje(doc: unknown): doc is ViajeDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viaje"
  );
}

function matchesLugar(viaje: Viaje, lugar?: string) {
  if (!lugar?.trim()) {
    return true;
  }

  const searchable = normalize(
    [
      viaje.establecimiento.nombre,
      viaje.establecimiento.direccion,
      viaje.establecimiento.contacto,
      viaje.servicio,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return searchable.includes(normalize(lugar));
}

function matchesDateRange(viaje: Viaje, filters: ViajeFilters) {
  const filterStart = parseDate(filters.fechaDesde);
  const filterEnd = parseDate(filters.fechaHasta);

  if (!filterStart && !filterEnd) {
    return true;
  }

  const tripStart = parseDate(viaje.fechaEntrada);
  const tripEnd = parseDate(viaje.fechaSalida);

  if (!tripStart || !tripEnd) {
    return false;
  }

  if (filterStart && tripEnd < filterStart) {
    return false;
  }

  if (filterEnd && tripStart > filterEnd) {
    return false;
  }

  return true;
}

export async function listViajes(
  filters: ViajeFilters,
): Promise<ViajeListItem[]> {
  const result = await db.allDocs({
    include_docs: true,
  });
  const viajes: ViajeListItem[] = [];

  for (const row of result.rows) {
    const doc = row.doc as ViajeDocument | undefined;

    if (!isViaje(doc)) {
      continue;
    }

    viajes.push({
      ...doc,
      docId: doc._id ?? doc.id,
    });
  }

  return viajes
    .filter((viaje) => matchesLugar(viaje, filters.lugar))
    .filter((viaje) => matchesDateRange(viaje, filters))
    .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada));
}

export async function getViajeByDocId(id: string): Promise<ViajeListItem | null> {
  try {
    const doc = (await db.get(id)) as ViajeDocument;

    if (!isViaje(doc)) {
      return null;
    }

    return {
      ...doc,
      docId: doc._id ?? doc.id,
    };
  } catch {
    return null;
  }
}
