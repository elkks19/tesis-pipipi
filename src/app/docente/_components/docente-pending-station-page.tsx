import type { ReactNode } from "react";

import { PendingHistoriesTable } from "@/app/estudiante/_components/pending-histories-table";
import type { StationHistoryPageResult } from "@/app/estudiante/_lib/station-history-queries";

type SearchParams = Promise<{
  cursor?: string | string[];
  cursors?: string | string[];
  q?: string | string[];
}>;

type DocentePendingStationPageProps = {
  basePath: string;
  description: string;
  emptyMessage: string;
  filterId: string;
  getPage: (input: {
    cursor?: string;
    query: string;
  }) => Promise<StationHistoryPageResult>;
  searchParams: SearchParams;
  statusIcon: ReactNode;
  title: string;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function DocentePendingStationPage({
  basePath,
  description,
  emptyMessage,
  filterId,
  getPage,
  searchParams,
  statusIcon,
  title,
}: DocentePendingStationPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const page = await getPage({
    cursor,
    query,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <PendingHistoriesTable
        basePath={basePath}
        cursor={cursor}
        cursors={cursors}
        emptyMessage={emptyMessage}
        filterId={filterId}
        page={page}
        query={query}
        statusIcon={statusIcon}
      />
    </div>
  );
}
