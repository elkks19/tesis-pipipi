import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  FilePenLineIcon,
  UserRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(date);
}

function getActionLabel(action: "created" | "updated", subject: string) {
  if (subject === "paciente") {
    return action === "created" ? "Paciente creado" : "Paciente actualizado";
  }

  return action === "created" ? "Registro creado" : "Registro editado";
}

function getPageHref({
  basePath,
  cursor,
}: {
  basePath: string;
  cursor?: string;
}) {
  return cursor ? `${basePath}?cursor=${encodeURIComponent(cursor)}` : basePath;
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
        <ItemGroup>
          {page.rows.map((row) => {
            const Icon =
              row.action === "created" ? ClipboardCheckIcon : FilePenLineIcon;

            return (
              <Item className="bg-background" key={row.id} variant="outline">
                <ItemMedia variant="icon">
                  <Icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {getActionLabel(row.action, row.subject)}
                  </ItemTitle>
                  <ItemDescription>
                    {row.pacienteName} · {row.pacienteDocument}
                  </ItemDescription>
                  <ItemDescription>
                    {row.changedFields.length > 0
                      ? `Campos: ${row.changedFields.join(", ")}`
                      : "Sin campos modificados detectados"}
                  </ItemDescription>
                </ItemContent>
                <ItemContent className="hidden flex-none md:flex">
                  <ItemTitle className="text-xs text-muted-foreground">
                    <UserRoundIcon />
                    {row.actorName}
                  </ItemTitle>
                  <ItemDescription>{formatDate(row.createdAt)}</ItemDescription>
                </ItemContent>
                <ItemActions className="basis-full justify-end sm:basis-auto md:hidden">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </span>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
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
