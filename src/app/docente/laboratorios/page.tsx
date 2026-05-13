import type { Metadata } from "next";
import { FlaskConicalIcon } from "lucide-react";

import { listPendingComplementaryExamHistories } from "@/app/estudiante/_lib/station-history-queries";

import { DocentePendingStationPage } from "../_components/docente-pending-station-page";

export const metadata: Metadata = {
  title: "Docente | Laboratorios",
};

export default function DocenteLaboratoriosPage({
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
      basePath="/docente/laboratorios"
      description="Selecciona una historia con laboratorios solicitados y registra sus resultados."
      emptyMessage="No hay historias con laboratorios solicitados pendientes de registro que coincidan con la busqueda."
      filterId="docente-laboratorios-search"
      getPage={({ cursor, query }) =>
        listPendingComplementaryExamHistories({
          cursor,
          examKey: "laboratorios",
          query,
        })
      }
      searchParams={searchParams}
      statusIcon={<FlaskConicalIcon />}
      title="Laboratorios"
    />
  );
}
