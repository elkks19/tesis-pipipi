import { StationActivityPage } from "@/components/activity/station-activity-page";
import type { StationKey } from "@/lib/station-histories";

type StationActivityRouteProps = {
  basePath: string;
  searchParams: Promise<{
    cursor?: string | string[];
  }>;
  stationKey: StationKey;
  title: string;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function EstudianteStationActivityRoute({
  basePath,
  searchParams,
  stationKey,
  title,
}: StationActivityRouteProps) {
  const params = await searchParams;

  return (
    <StationActivityPage
      basePath={basePath}
      cursor={getParam(params.cursor)}
      mode="estudiante"
      stationKey={stationKey}
      title={title}
    />
  );
}
