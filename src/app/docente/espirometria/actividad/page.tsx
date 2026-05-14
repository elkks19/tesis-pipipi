import { DocenteStationActivityRoute } from "../../_components/station-activity-route";

export default function DocenteEspirometriaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <DocenteStationActivityRoute
      basePath="/docente/espirometria/actividad"
      searchParams={searchParams}
      stationKey="espirometria"
      title="Actividad de espirometria"
    />
  );
}
