import type { Metadata } from "next";
import { ScanSearchIcon } from "lucide-react";

import { DocentePendingStationPage } from "../_components/docente-pending-station-page";

export const metadata: Metadata = {
  title: "Docente | Examen fisico segmentario",
};

export default function DocenteExamenFisicoSegmentarioPage({
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
      basePath="/docente/examen-fisico-segmentario"
      description="Revisa y edita los examenes fisicos segmentarios producidos en tu estacion."
      emptyMessage="No hay examenes fisicos segmentarios registrados en tu estacion que coincidan con la busqueda."
      filterId="docente-examen-fisico-segmentario-search"
      searchParams={searchParams}
      stationKey="examenFisicoSegmentario"
      statusIcon={<ScanSearchIcon />}
      title="Examen fisico segmentario"
    />
  );
}
