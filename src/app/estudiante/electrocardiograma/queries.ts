import "server-only";

import {
  listStationHistories,
  type StationHistoryPageResult,
  type StationHistoryRow,
} from "@/lib/station-histories";
import { getAuthenticatedUserId } from "@/lib/auth-session";

export type ElectrocardiogramaRow = StationHistoryRow;
export type ElectrocardiogramaPageResult = StationHistoryPageResult;

export async function listHistoriasForElectrocardiograma({
  cursor,
  query,
}: {
  cursor?: string;
  query: string;
}): Promise<ElectrocardiogramaPageResult> {
  const userId = await getAuthenticatedUserId();
  return listStationHistories({
    cursor,
    includeCompleted: true,
    mode: "estudiante",
    newestFirst: true,
    query,
    stationKey: "electrocardiograma",
    userId: userId ?? "",
  });
}
