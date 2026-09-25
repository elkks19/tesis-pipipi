import "server-only";

import {
  listStationHistories,
  type StationHistoryPageResult,
  type StationHistoryRow,
} from "@/lib/station-histories";

export type ExamenFisicoGeneralRow = StationHistoryRow & {
  examenFisicoGeneralCompleto: boolean;
};

export type ExamenFisicoGeneralPageResult = Omit<
  StationHistoryPageResult,
  "rows"
> & {
  rows: ExamenFisicoGeneralRow[];
};

export async function listHistoriasForExamenFisicoGeneral({
  cursor,
  query,
}: {
  cursor?: string;
  query: string;
}): Promise<ExamenFisicoGeneralPageResult> {
  const page = await listStationHistories({
    cursor,
    includeCompleted: true,
    mode: "estudiante",
    newestFirst: true,
    query,
    stationKey: "examenFisicoGeneral",
  });

  return {
    ...page,
    rows: page.rows.map((row) => ({
      ...row,
      examenFisicoGeneralCompleto: row.stationCompleted,
    })),
  };
}
