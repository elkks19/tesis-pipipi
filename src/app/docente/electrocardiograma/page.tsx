import type { Metadata } from "next";
import { ActivityIcon } from "lucide-react";

import { listPendingComplementaryExamHistories } from "@/app/estudiante/_lib/station-history-queries";

import { DocentePendingStationPage } from "../_components/docente-pending-station-page";

export const metadata: Metadata = {
  title: "Docente | Electrocardiograma",
};

export default function DocenteElectrocardiogramaPage({
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
      basePath="/docente/electrocardiograma"
      description="Selecciona una historia con electrocardiograma solicitado y registra sus resultados."
      emptyMessage="No hay historias con electrocardiograma solicitado pendientes de registro que coincidan con la busqueda."
      filterId="docente-electrocardiograma-search"
      getPage={({ cursor, query }) =>
        listPendingComplementaryExamHistories({
          cursor,
          examKey: "electrocardiograma",
          query,
        })
      }
      searchParams={searchParams}
      statusIcon={<ActivityIcon />}
      title="Electrocardiograma"
    />
  );
}
