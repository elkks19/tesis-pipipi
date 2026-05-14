import type { Metadata } from "next";
import { ActivityIcon } from "lucide-react";

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
      description="Revisa y edita los electrocardiogramas producidos en tu estacion."
      emptyMessage="No hay electrocardiogramas registrados en tu estacion que coincidan con la busqueda."
      filterId="docente-electrocardiograma-search"
      searchParams={searchParams}
      stationKey="electrocardiograma"
      statusIcon={<ActivityIcon />}
      title="Electrocardiograma"
    />
  );
}
