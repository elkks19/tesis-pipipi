import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StationActivityList } from "@/components/activity/station-activity-list";
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

function getPageHref({
  basePath,
  cursor,
}: {
  basePath: string;
  cursor?: string;
}) {
  return cursor ? `${basePath}?cursor=${encodeURIComponent(cursor)}` : basePath;
}

function getStationBasePath(basePath: string) {
  return basePath.endsWith("/actividad")
    ? basePath.slice(0, -"/actividad".length)
    : basePath;
}

function getEditHref({
  basePath,
  historiaId,
  mode,
  pacienteId,
  subject,
  stationKey,
}: {
  basePath: string;
  historiaId?: string;
  mode: "docente" | "estudiante";
  pacienteId: string;
  subject: "historia" | "paciente";
  stationKey: StationKey;
}) {
  const stationBasePath = getStationBasePath(basePath);

  if (subject === "paciente" && stationKey === "anamnesis") {
    return `${stationBasePath}/pacientes/${encodeURIComponent(pacienteId)}/edit`;
  }

  if (mode === "docente" && historiaId) {
    return `${stationBasePath}/${encodeURIComponent(historiaId)}`;
  }

  return undefined;
}

function getReportHref(historia?: { reporteHistoria?: { url: string } }) {
  return historia?.reporteHistoria?.url;
}

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
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Revisa los cambios registrados en esta estacion. Los eventos guardan
          campos modificados, no valores clinicos.
        </p>
      </div>

      {page.rows.length > 0 ? (
        <StationActivityList
          mode={mode}
          rows={page.rows.map((row) => ({
            ...row,
            editHref: getEditHref({
              basePath,
              historiaId: row.historiaId,
              mode,
              pacienteId: row.pacienteId,
              stationKey,
              subject: row.subject,
            }),
            reportHref: getReportHref(row.historia),
          }))}
        />
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-background px-6 py-8 text-center">
          <ClipboardCheckIcon className="text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Sin actividad</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Los cambios nuevos de esta estacion apareceran aqui.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button asChild={Boolean(cursor)} disabled={!cursor} variant="outline">
          {cursor ? (
            <Link href={basePath}>
              <ChevronLeftIcon data-icon="inline-start" />
              Recientes
            </Link>
          ) : (
            <>
              <ChevronLeftIcon data-icon="inline-start" />
              Recientes
            </>
          )}
        </Button>
        <Button
          asChild={page.hasNextPage}
          disabled={!page.hasNextPage}
          variant="outline"
        >
          {page.hasNextPage && page.nextCursor ? (
            <Link href={getPageHref({ basePath, cursor: page.nextCursor })}>
              Anteriores
              <ChevronRightIcon data-icon="inline-end" />
            </Link>
          ) : (
            <>
              Anteriores
              <ChevronRightIcon data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
