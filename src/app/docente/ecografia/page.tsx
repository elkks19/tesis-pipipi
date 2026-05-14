import type { Metadata } from "next";
import { ImagePlusIcon } from "lucide-react";

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
      description="Revisa y edita las ecografias producidas en tu estacion."
      emptyMessage="No hay ecografias registradas en tu estacion que coincidan con la busqueda."
      filterId="docente-ecografia-search"
      searchParams={searchParams}
      stationKey="ecografia"
      statusIcon={<ImagePlusIcon />}
      title="Ecografia"
    />
  );
}
