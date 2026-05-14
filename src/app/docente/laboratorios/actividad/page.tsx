import { DocenteStationActivityRoute } from "../../_components/station-activity-route";

export default function DocenteLaboratoriosActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <DocenteStationActivityRoute
      basePath="/docente/laboratorios/actividad"
      searchParams={searchParams}
      stationKey="laboratorios"
      title="Actividad de laboratorios"
    />
  );
}
