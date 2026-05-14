import type { Metadata } from "next";
import { EstudianteStationActivityRoute } from "../../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Actividad de laboratorios",
};

export default function LaboratoriosActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/laboratorios/actividad"
      searchParams={searchParams}
      stationKey="laboratorios"
      title="Actividad de laboratorios"
    />
  );
}
