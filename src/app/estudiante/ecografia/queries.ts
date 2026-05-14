import "server-only";

import {
  listStationHistories,
  type StationHistoryPageResult,
  type StationHistoryRow,
} from "@/lib/station-histories";

export type EcografiaRow = StationHistoryRow;
export type EcografiaPageResult = StationHistoryPageResult;

export async function listHistoriasForEcografia({
  cursor,
  query,
}: {
  cursor?: string;
  query: string;
}): Promise<EcografiaPageResult> {
  return listStationHistories({
    cursor,
    mode: "estudiante",
    query,
    stationKey: "ecografia",
  });
}
