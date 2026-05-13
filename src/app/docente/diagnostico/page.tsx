import type { Metadata } from "next";
import { FileCheck2Icon } from "lucide-react";

import { listHistoriasForDiagnostico } from "@/app/estudiante/diagnostico/queries";

import { DocentePendingStationPage } from "../_components/docente-pending-station-page";

export const metadata: Metadata = {
  title: "Docente | Diagnostico",
};

export default function DocenteDiagnosticoPage({
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
      basePath="/docente/diagnostico"
      description="Selecciona una historia pendiente de cierre y registra el diagnostico codificado CIE-11."
      emptyMessage="No hay historias pendientes de diagnostico que coincidan con la busqueda."
      filterId="docente-diagnostico-search"
      getPage={listHistoriasForDiagnostico}
      searchParams={searchParams}
      statusIcon={<FileCheck2Icon />}
      title="Diagnostico"
    />
  );
}
