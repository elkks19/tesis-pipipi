import type { Metadata } from "next";
import { ClipboardPenLineIcon } from "lucide-react";

import { listHistoriasForExamenFisicoGeneral } from "@/app/estudiante/examen-fisico-general/queries";

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
      description="Selecciona una historia pendiente y registra sus signos vitales, presion arterial y mediciones antropometricas."
      emptyMessage="No hay historias pendientes de examen fisico general que coincidan con la busqueda."
      filterId="docente-examen-fisico-general-search"
      getPage={async ({ cursor, query }) => {
        const page = await listHistoriasForExamenFisicoGeneral({
          cursor,
          query,
        });

        return {
          ...page,
          rows: page.rows.filter((row) => !row.examenFisicoGeneralCompleto),
        };
      }}
      searchParams={searchParams}
      statusIcon={<ClipboardPenLineIcon />}
      title="Examen fisico general"
    />
  );
}
