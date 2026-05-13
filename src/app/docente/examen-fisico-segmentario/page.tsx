import type { Metadata } from "next";
import { ScanSearchIcon } from "lucide-react";

import { DocentePendingStationPage } from "../_components/docente-pending-station-page";
import { listHistoriasForExamenFisicoSegmentario } from "@/app/estudiante/examen-fisico-segmentario/queries";

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
      description="Selecciona una historia pendiente y registra o revisa la exploracion por regiones, aparatos y sistemas."
      emptyMessage="No hay historias pendientes de examen fisico segmentario que coincidan con la busqueda."
      filterId="docente-examen-fisico-segmentario-search"
      getPage={listHistoriasForExamenFisicoSegmentario}
      searchParams={searchParams}
      statusIcon={<ScanSearchIcon />}
      title="Examen fisico segmentario"
    />
  );
}
