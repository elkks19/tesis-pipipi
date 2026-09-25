import type { ReactNode } from "react";
import { connection } from "next/server";

import { PendingHistoriesTable } from "@/app/estudiante/_components/pending-histories-table";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import {
  listStationHistories,
  type StationKey,
} from "@/lib/station-histories";

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
  searchParams: SearchParams;
  stationKey: StationKey;
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
  searchParams,
  stationKey,
  statusIcon,
  title,
}: DocentePendingStationPageProps) {
  await connection();

  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const userId = await getAuthenticatedUserId();
  const page = await listStationHistories({
    cursor,
    mode: "docente",
    newestFirst: true,
    query,
    stationKey,
    userId: userId ?? undefined,
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
        mode="docente"
        page={page}
        query={query}
        stationKey={stationKey}
        statusIcon={statusIcon}
      />
    </div>
  );
}
