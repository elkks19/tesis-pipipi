"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";

import { StationActivityList } from "@/components/activity/station-activity-list";
import {
  type ActivityListRow,
  type ActivityMode,
  withActivityLinks,
} from "@/components/activity/station-activity-links";
import { Button } from "@/components/ui/button";
import type { ActivityListItem } from "@/lib/activity-queries";
import type { StationKey } from "@/lib/station-histories";

type ActivityFeedPage = {
  hasNextPage: boolean;
  nextCursor?: string;
  rows: ActivityListItem[];
};

type StationActivityFeedProps = {
  basePath: string;
  hasNextPage: boolean;
  initialRows: ActivityListRow[];
  mode: ActivityMode;
  nextCursor?: string;
  stationKey: StationKey;
};

export function StationActivityFeed({
  basePath,
  hasNextPage,
  initialRows,
  mode,
  nextCursor,
  stationKey,
}: StationActivityFeedProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState(nextCursor);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState(initialRows);
  const [canLoadMore, setCanLoadMore] = useState(hasNextPage);

  const loadMore = useCallback(async () => {
    if (!canLoadMore || !cursor || isLoading) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        cursor,
        mode,
        stationKey,
      });
      const response = await fetch(`/api/activity/station?${params}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar mas actividad.");
      }

      const page = (await response.json()) as ActivityFeedPage;

      setRows((currentRows) => [
        ...currentRows,
        ...withActivityLinks({
          basePath,
          mode,
          rows: page.rows,
          stationKey,
        }),
      ]);
      setCanLoadMore(page.hasNextPage);
      setCursor(page.nextCursor);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar mas actividad.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [basePath, canLoadMore, cursor, isLoading, mode, stationKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !canLoadMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [canLoadMore, loadMore]);

  return (
    <div className="flex flex-col gap-4">
      <StationActivityList mode={mode} rows={rows} />

      <div
        aria-hidden="true"
        className="h-px w-full"
        ref={sentinelRef}
      />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Cargando mas actividad...
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={loadMore} size="sm" type="button" variant="outline">
            Intentar de nuevo
          </Button>
        </div>
      ) : null}

      {!canLoadMore && rows.length > 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Ya llegaste al inicio de la actividad de este viaje.
        </p>
      ) : null}
    </div>
  );
}
