import "server-only";

import type { ViajeListItem } from "@/app/admin/viajes/queries";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { DataScienceTripOption } from "@/lib/data-science-types";
import type { Viaje } from "@/lib/schema/viajes";

type ViajeDocument = PouchDB.Core.ExistingDocument<Viaje>;

type SearchTripOptionsParams = {
  cursor?: string | null;
  limit?: number;
  query?: string;
};

export function toDataScienceTripOptions(
  viajes: ViajeListItem[],
): DataScienceTripOption[] {
  return viajes.map((viaje) => ({
    dateLabel: `${formatDate(viaje.fechaEntrada)} - ${formatDate(viaje.fechaSalida)}`,
    id: viaje.docId,
    label: `${viaje.servicio} / ${viaje.establecimiento.nombre}`,
    secondaryLabel: viaje.establecimiento.direccion ?? "Sin direccion registrada",
  }));
}

export async function searchDataScienceTripOptions({
  cursor,
  limit = 20,
  query = "",
}: SearchTripOptionsParams) {
  await ensureTesisIndexes();

  const normalizedQuery = normalizeSearch(query);
  const selectedLimit = Math.min(Math.max(limit, 1), 50);
  const items: DataScienceTripOption[] = [];
  let bookmark = cursor || undefined;
  let hasMore = false;

  for (let scannedPages = 0; scannedPages < 8 && items.length < selectedLimit; scannedPages += 1) {
    const result = await findTesisDocs({
      bookmark,
      limit: Math.max(selectedLimit, 25),
      selector: { type: "viaje" },
      use_index: "idx_type",
    });
    const docs = result.docs.filter(isViaje);
    bookmark = result.bookmark;

    for (const viaje of docs) {
      if (!matchesTripSearch(viaje, normalizedQuery)) {
        continue;
      }

      items.push(toTripOption(viaje));
      if (items.length >= selectedLimit) {
        break;
      }
    }

    if (docs.length === 0 || !result.bookmark) {
      hasMore = false;
      break;
    }

    hasMore = true;
  }

  return {
    hasMore,
    items,
    nextCursor: hasMore ? bookmark ?? null : null,
  };
}

function isViaje(doc: unknown): doc is ViajeDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viaje"
  );
}

function toTripOption(viaje: ViajeDocument): DataScienceTripOption {
  return {
    dateLabel: `${formatDate(viaje.fechaEntrada)} - ${formatDate(viaje.fechaSalida)}`,
    id: viaje._id ?? viaje.id,
    label: `${viaje.servicio} / ${viaje.establecimiento.nombre}`,
    secondaryLabel: viaje.establecimiento.direccion ?? "Sin direccion registrada",
  };
}

function matchesTripSearch(viaje: ViajeDocument, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const searchable = normalizeSearch(
    [
      viaje.servicio,
      viaje.establecimiento.nombre,
      viaje.establecimiento.direccion,
      viaje.establecimiento.contacto,
      viaje.fechaEntrada,
      viaje.fechaSalida,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return searchable.includes(normalizedQuery);
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
