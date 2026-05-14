import type { Metadata } from "next";
import { EstudianteStationActivityRoute } from "../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Actividad",
};

export default function AnamnesisActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/anamnesis"
      searchParams={searchParams}
      stationKey="anamnesis"
      title="Actividad de anamnesis"
    />
  );
}
