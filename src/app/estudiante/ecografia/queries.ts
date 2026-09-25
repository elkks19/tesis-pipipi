import "server-only";

import {
  listStationHistories,
  type StationHistoryPageResult,
  type StationHistoryRow,
} from "@/lib/station-histories";
import { getAuthenticatedUserId } from "@/lib/auth-session";

export type EcografiaRow = StationHistoryRow;
export type EcografiaPageResult = StationHistoryPageResult;

export async function listHistoriasForEcografia({
  cursor,
  query,
}: {
  cursor?: string;
  query: string;
}): Promise<EcografiaPageResult> {
  const userId = await getAuthenticatedUserId();
  return listStationHistories({
    cursor,
    includeCompleted: true,
    mode: "estudiante",
    newestFirst: true,
    query,
    stationKey: "ecografia",
    userId: userId ?? "",
  });
}
