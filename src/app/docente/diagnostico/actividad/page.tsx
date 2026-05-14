import { DocenteStationActivityRoute } from "../../_components/station-activity-route";

export default function DocenteDiagnosticoActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <DocenteStationActivityRoute
      basePath="/docente/diagnostico/actividad"
      searchParams={searchParams}
      stationKey="diagnostico"
      title="Actividad de diagnostico"
    />
  );
}
