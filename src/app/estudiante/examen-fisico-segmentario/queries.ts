import "server-only";

import {
  listStationHistories,
  type StationHistoryPageResult,
  type StationHistoryRow,
} from "@/lib/station-histories";

export type ExamenFisicoSegmentarioRow = StationHistoryRow;
export type ExamenFisicoSegmentarioPageResult = StationHistoryPageResult;

export async function listHistoriasForExamenFisicoSegmentario({
  cursor,
  query,
}: {
  cursor?: string;
  query: string;
}): Promise<ExamenFisicoSegmentarioPageResult> {
  return listStationHistories({
    cursor,
    includeCompleted: true,
    mode: "estudiante",
    newestFirst: true,
    query,
    stationKey: "examenFisicoSegmentario",
  });
}
