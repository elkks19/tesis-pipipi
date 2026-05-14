import { DocenteStationActivityRoute } from "../_components/station-activity-route";

export default function DocenteAnamnesisActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <DocenteStationActivityRoute
      basePath="/docente/anamnesis"
      searchParams={searchParams}
      stationKey="anamnesis"
      title="Actividad de anamnesis"
    />
  );
}
