import type { Metadata } from "next";
import { EstudianteStationActivityRoute } from "../../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Actividad",
};

export default function ExamenFisicoSegmentarioActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/examen-fisico-segmentario/actividad"
      searchParams={searchParams}
      stationKey="examenFisicoSegmentario"
      title="Actividad de examen fisico segmentario"
    />
  );
}
