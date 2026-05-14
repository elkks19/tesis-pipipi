import type { Metadata } from "next";
import { WindIcon } from "lucide-react";

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
      description="Revisa y edita las espirometrias producidas en tu estacion."
      emptyMessage="No hay espirometrias registradas en tu estacion que coincidan con la busqueda."
      filterId="docente-espirometria-search"
      searchParams={searchParams}
      stationKey="espirometria"
      statusIcon={<WindIcon />}
      title="Espirometria"
    />
  );
}
