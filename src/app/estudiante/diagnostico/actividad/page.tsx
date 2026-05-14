import type { Metadata } from "next";
import { EstudianteStationActivityRoute } from "../../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Actividad de diagnostico",
};

export default function DiagnosticoActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/diagnostico/actividad"
      searchParams={searchParams}
      stationKey="diagnostico"
      title="Actividad de diagnostico"
    />
  );
}
