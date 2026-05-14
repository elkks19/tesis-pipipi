import "server-only";

import {
  listStationHistories,
  type StationHistoryPageResult,
  type StationHistoryRow,
} from "@/lib/station-histories";

export type ElectrocardiogramaRow = StationHistoryRow;
export type ElectrocardiogramaPageResult = StationHistoryPageResult;

export async function listHistoriasForElectrocardiograma({
  cursor,
  query,
}: {
  cursor?: string;
  query: string;
}): Promise<ElectrocardiogramaPageResult> {
  return listStationHistories({
    cursor,
    mode: "estudiante",
    query,
    stationKey: "electrocardiograma",
  });
}
