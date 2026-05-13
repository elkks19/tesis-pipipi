import type { Metadata } from "next";
import { WindIcon } from "lucide-react";

import { listPendingComplementaryExamHistories } from "@/app/estudiante/_lib/station-history-queries";

import { DocentePendingStationPage } from "../_components/docente-pending-station-page";

export const metadata: Metadata = {
  title: "Docente | Espirometria",
};

export default function DocenteEspirometriaPage({
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
      basePath="/docente/espirometria"
      description="Selecciona una historia con espirometria solicitada y registra sus resultados."
      emptyMessage="No hay historias con espirometria solicitada pendientes de registro que coincidan con la busqueda."
      filterId="docente-espirometria-search"
      getPage={({ cursor, query }) =>
        listPendingComplementaryExamHistories({
          cursor,
          examKey: "espirometria",
          query,
        })
      }
      searchParams={searchParams}
      statusIcon={<WindIcon />}
      title="Espirometria"
    />
  );
}
