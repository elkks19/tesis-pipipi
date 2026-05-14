import type { Metadata } from "next";
import { ClipboardPenLineIcon } from "lucide-react";

import { DocentePendingStationPage } from "../_components/docente-pending-station-page";

export const metadata: Metadata = {
  title: "Docente | Examen fisico general",
};

export default function DocenteExamenFisicoGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string | string[];
    cursors?: string | string[];
    q?: string | string[];
  }>;
}) {
  return (
    <DocentePendingStationPage
      basePath="/docente/examen-fisico-general"
      description="Revisa y edita los examenes fisicos generales producidos en tu estacion."
      emptyMessage="No hay examenes fisicos generales registrados en tu estacion que coincidan con la busqueda."
      filterId="docente-examen-fisico-general-search"
      searchParams={searchParams}
      stationKey="examenFisicoGeneral"
      statusIcon={<ClipboardPenLineIcon />}
      title="Examen fisico general"
    />
  );
}
