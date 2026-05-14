import type { Metadata } from "next";
import { FileCheck2Icon } from "lucide-react";

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
      description="Revisa y edita los diagnosticos producidos en tu estacion."
      emptyMessage="No hay diagnosticos registrados en tu estacion que coincidan con la busqueda."
      filterId="docente-diagnostico-search"
      searchParams={searchParams}
      stationKey="diagnostico"
      statusIcon={<FileCheck2Icon />}
      title="Diagnostico"
    />
  );
}
