import { DocenteStationActivityRoute } from "../../_components/station-activity-route";

export default function DocenteExamenFisicoSegmentarioActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <DocenteStationActivityRoute
      basePath="/docente/examen-fisico-segmentario/actividad"
      searchParams={searchParams}
      stationKey="examenFisicoSegmentario"
      title="Actividad de examen fisico segmentario"
    />
  );
}
