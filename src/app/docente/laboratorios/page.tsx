import type { Metadata } from "next";
import { FlaskConicalIcon } from "lucide-react";

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
      description="Revisa y edita los laboratorios producidos en tu estacion."
      emptyMessage="No hay laboratorios registrados en tu estacion que coincidan con la busqueda."
      filterId="docente-laboratorios-search"
      searchParams={searchParams}
      stationKey="laboratorios"
      statusIcon={<FlaskConicalIcon />}
      title="Laboratorios"
    />
  );
}
