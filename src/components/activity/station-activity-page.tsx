import { ClipboardCheckIcon } from "lucide-react";

import { StationActivityFeed } from "@/components/activity/station-activity-feed";
import {
  getActivityDescription,
  getActivityEmptyCopy,
  getActivityTitle,
  withActivityLinks,
} from "@/components/activity/station-activity-links";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { listActivity } from "@/lib/activity-queries";
import type { StationKey } from "@/lib/station-histories";

type StationActivityPageProps = {
  basePath: string;
  cursor?: string;
  mode: "docente" | "estudiante";
  stationKey: StationKey;
  title: string;
};

export async function StationActivityPage({
  basePath,
  cursor,
  mode,
  stationKey,
  title,
}: StationActivityPageProps) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return null;
  }

  const page = await listActivity({
    cursor,
    mode,
    stationKey,
    userId,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          {getActivityTitle({ mode, stationKey }) || title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {getActivityDescription(mode)}
        </p>
      </div>

      {page.rows.length > 0 ? (
        <StationActivityFeed
          basePath={basePath}
          hasNextPage={page.hasNextPage}
          initialRows={withActivityLinks({
            basePath,
            mode,
            rows: page.rows,
            stationKey,
          })}
          mode={mode}
          nextCursor={page.nextCursor}
          stationKey={stationKey}
        />
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-background px-6 py-8 text-center">
          <ClipboardCheckIcon className="text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Sin actividad</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {getActivityEmptyCopy(mode)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
