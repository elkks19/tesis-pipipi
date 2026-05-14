import type { Metadata } from "next";
import { EstudianteStationActivityRoute } from "../../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Actividad de espirometria",
};

export default function EspirometriaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/espirometria/actividad"
      searchParams={searchParams}
      stationKey="espirometria"
      title="Actividad de espirometria"
    />
  );
}
