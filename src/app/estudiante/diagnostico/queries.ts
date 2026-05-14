import "server-only";

import {
  listStationHistories,
  type StationHistoryPageResult,
} from "@/lib/station-histories";

export async function listHistoriasForDiagnostico({
  cursor,
  query,
}: {
  cursor?: string;
  query: string;
}): Promise<StationHistoryPageResult> {
  return listStationHistories({
    cursor,
    mode: "estudiante",
    query,
    stationKey: "diagnostico",
  });
}
