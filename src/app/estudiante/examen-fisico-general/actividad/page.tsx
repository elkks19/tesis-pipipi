import type { Metadata } from "next";
import { EstudianteStationActivityRoute } from "../../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Actividad",
};

export default function ExamenFisicoGeneralActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/examen-fisico-general/actividad"
      searchParams={searchParams}
      stationKey="examenFisicoGeneral"
      title="Actividad de examen fisico general"
    />
  );
}
