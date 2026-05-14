import type { Metadata } from "next";
import { EstudianteStationActivityRoute } from "../../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Actividad de ecografia",
};

export default function EcografiaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/ecografia/actividad"
      searchParams={searchParams}
      stationKey="ecografia"
      title="Actividad de ecografia"
    />
  );
}
