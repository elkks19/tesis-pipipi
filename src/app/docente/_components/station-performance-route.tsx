import { StationPerformancePage } from "@/components/docente/station-performance-page";
import type { StationKey } from "@/lib/station-histories";

type StationPerformanceRouteProps = {
  stationKey: StationKey;
};

export function DocenteStationPerformanceRoute({
  stationKey,
}: StationPerformanceRouteProps) {
  return <StationPerformancePage stationKey={stationKey} />;
}
