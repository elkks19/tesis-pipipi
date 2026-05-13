import type { Metadata } from "next";
import { ImagePlusIcon } from "lucide-react";

import { listPendingComplementaryExamHistories } from "@/app/estudiante/_lib/station-history-queries";

import { DocentePendingStationPage } from "../_components/docente-pending-station-page";

export const metadata: Metadata = {
  title: "Docente | Ecografia",
};

export default function DocenteEcografiaPage({
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
      basePath="/docente/ecografia"
      description="Selecciona una historia con ecografia solicitada y registra sus hallazgos junto a la fotografia del estudio."
      emptyMessage="No hay historias con ecografia solicitada pendientes de registro que coincidan con la busqueda."
      filterId="docente-ecografia-search"
      getPage={({ cursor, query }) =>
        listPendingComplementaryExamHistories({
          cursor,
          examKey: "ecografia",
          query,
        })
      }
      searchParams={searchParams}
      statusIcon={<ImagePlusIcon />}
      title="Ecografia"
    />
  );
}
