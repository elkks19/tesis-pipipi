import "server-only";

import {
  listStationHistories,
  type StationHistoryPageResult,
  type StationHistoryRow,
} from "@/lib/station-histories";

type ComplementaryExamKey =
  | "ecografia"
  | "electrocardiograma"
  | "espirometria"
  | "laboratorios";

export type { StationHistoryPageResult, StationHistoryRow };

export async function listPendingComplementaryExamHistories({
  cursor,
  examKey,
  query,
}: {
  cursor?: string;
  examKey: ComplementaryExamKey;
  query: string;
}): Promise<StationHistoryPageResult> {
  return listStationHistories({
    cursor,
    includeCompleted: true,
    mode: "estudiante",
    newestFirst: true,
    query,
    stationKey: examKey,
  });
}
