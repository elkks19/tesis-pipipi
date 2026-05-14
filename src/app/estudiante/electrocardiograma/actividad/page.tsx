import type { Metadata } from "next";
import { EstudianteStationActivityRoute } from "../../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Actividad de electrocardiograma",
};

export default function ElectrocardiogramaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/electrocardiograma/actividad"
      searchParams={searchParams}
      stationKey="electrocardiograma"
      title="Actividad de electrocardiograma"
    />
  );
}
