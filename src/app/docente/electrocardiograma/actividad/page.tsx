import { DocenteStationActivityRoute } from "../../_components/station-activity-route";

export default function DocenteElectrocardiogramaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <DocenteStationActivityRoute
      basePath="/docente/electrocardiograma/actividad"
      searchParams={searchParams}
      stationKey="electrocardiograma"
      title="Actividad de electrocardiograma"
    />
  );
}
