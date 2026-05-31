import "server-only";

import type { ViajeListItem } from "@/app/admin/viajes/queries";
import type { DataScienceTripOption } from "@/lib/data-science-types";

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
