import { DocenteStationActivityRoute } from "../../_components/station-activity-route";

export default function DocenteEcografiaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <DocenteStationActivityRoute
      basePath="/docente/ecografia/actividad"
      searchParams={searchParams}
      stationKey="ecografia"
      title="Actividad de ecografia"
    />
  );
}
