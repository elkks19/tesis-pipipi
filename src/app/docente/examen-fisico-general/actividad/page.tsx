import { DocenteStationActivityRoute } from "../../_components/station-activity-route";

export default function DocenteExamenFisicoGeneralActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <DocenteStationActivityRoute
      basePath="/docente/examen-fisico-general/actividad"
      searchParams={searchParams}
      stationKey="examenFisicoGeneral"
      title="Actividad de examen fisico general"
    />
  );
}
