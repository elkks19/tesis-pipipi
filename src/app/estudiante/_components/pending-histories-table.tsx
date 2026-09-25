import Link from "next/link";
import type { ReactNode } from "react";
import {
  ChevronLeftIcon, ChevronRightIcon, ClipboardCheckIcon,
  ClipboardPenLineIcon, IdCardIcon, ScrollTextIcon, SearchXIcon, UserRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { StationKey } from "@/lib/station-histories";
import { StationHistoriasFilters } from "./station-historias-filters";
import type { StationHistoryPageResult } from "../_lib/station-history-queries";
import { LaboratoriosHistorialButton } from "../laboratorios/laboratorios-historial-button";
import { ElectrocardiogramaHistorialButton } from "../electrocardiograma/electrocardiograma-historial-button";
import { EcografiaHistorialButton } from "../ecografia/ecografia-historial-button";
import { EspirometriaHistorialButton } from "../espirometria/espirometria-historial-button";
import { DiagnosticoHistorialButton } from "../diagnostico/diagnostico-historial-button";

type PendingHistoriesTableProps = {
  basePath: string;
  cursor: string;
  cursors: string[];
  emptyMessage: string;
  filterId: string;
  mode?: "docente" | "estudiante";
  page: StationHistoryPageResult;
  query: string;
  stationKey: StationKey;
  statusIcon: ReactNode;
  statusLabel?: string;
};

function getPacienteName(paciente: PacienteSearchResult) {
  const { nombres, apellidoPaterno, apellidoMaterno } = paciente.datosPersonales;
  return [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ");
}

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatHistoryDate(value?: string) {
  if (!value) return "Fecha no registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no registrada";
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short",
    timeZone: "America/La_Paz", year: "numeric",
  }).format(date);
}

function getPlace(paciente: PacienteSearchResult) {
  return [paciente.lugarNacimiento.distrito, paciente.lugarNacimiento.departamento, paciente.lugarNacimiento.pais]
    .filter(Boolean).join(", ");
}

function getPageHref({ basePath, cursor, cursors, query }: {
  basePath: string; cursor?: string; cursors: string[]; query: string;
}) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (cursor) params.set("cursor", cursor);
  if (cursors.length > 0) params.set("cursors", cursors.join(","));
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

function getStationReportHref(historiaId: string) {
  return `/reportes/historias/${encodeURIComponent(historiaId)}?at=${Date.now()}`;
}

export function PendingHistoriesTable({
  basePath, cursor, cursors, emptyMessage, filterId, mode = "estudiante",
  page, query, stationKey, statusIcon, statusLabel,
}: PendingHistoriesTableProps) {
  const previousCursor = cursors.at(-1);
  const previousCursors = cursors.slice(0, -1);
  const nextCursors = cursor ? [...cursors, cursor] : cursors;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-background p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Seleccionar historia</h2>
        <p className="text-sm text-muted-foreground">Busca por identidad y continúa con el registro correspondiente.</p>
      </div>
      <StationHistoriasFilters id={filterId} query={query} />

      <div className="grid gap-3">
        {page.rows.length > 0 ? page.rows.map((row) => {
          const datos = row.paciente.datosPersonales;
          const completed = row.stationCompleted;
          const label = completed ? (mode === "docente" ? "Registrado" : "Completado") : statusLabel ?? "Pendiente";
          return (
            <article className="min-w-0 overflow-hidden rounded-xl border bg-background shadow-xs transition-colors hover:border-primary/30" key={row.historiaId}>
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                    <UserRoundIcon aria-hidden="true" className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold sm:text-base">{getPacienteName(row.paciente)}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{row.paciente.genero} · Historia del {formatHistoryDate(row.createdAt)}</p>
                  </div>
                  <span className={completed
                    ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    : "inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"}>
                    {completed ? <ClipboardCheckIcon aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true" className="[&_svg]:size-3.5">{statusIcon}</span>}
                    {label}
                  </span>
                </div>
                <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
                  <div className="min-w-0"><dt className="text-xs text-muted-foreground">Documento</dt><dd className="mt-1 flex items-center gap-1.5 break-words font-medium"><IdCardIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />{datos.documentoIdentidad} {datos.numeroDocumentoIdentidad}</dd></div>
                  <div className="min-w-0"><dt className="text-xs text-muted-foreground">Nacimiento</dt><dd className="mt-1 font-medium">{formatDate(datos.fechaNacimiento)}</dd></div>
                  <div className="min-w-0"><dt className="text-xs text-muted-foreground">Procedencia</dt><dd className="mt-1 break-words font-medium">{getPlace(row.paciente) || "Sin lugar"}</dd></div>
                </dl>
              </div>
              <div className="flex flex-col gap-3 border-t bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-muted-foreground">Historia clínica vinculada al paciente</p>
                <div className="flex flex-wrap items-center gap-2">
                  {mode === "estudiante" && stationKey === "laboratorios" ? (
                    <LaboratoriosHistorialButton historiaId={row.historiaId} />
                  ) : null}
                  {mode === "estudiante" && stationKey === "electrocardiograma" ? (
                    <ElectrocardiogramaHistorialButton historiaId={row.historiaId} />
                  ) : null}
                  {mode === "estudiante" && stationKey === "ecografia" ? (
                    <EcografiaHistorialButton historiaId={row.historiaId} />
                  ) : null}
                  {mode === "estudiante" && stationKey === "espirometria" ? (
                    <EspirometriaHistorialButton hasClinicalDetail={completed} historiaId={row.historiaId} />
                  ) : null}
                  {mode === "estudiante" && stationKey === "diagnostico" ? (
                    <DiagnosticoHistorialButton hasClinicalDetail={completed} historiaId={row.historiaId} />
                  ) : null}
                  {mode === "docente" ? (
                    <Button asChild size="sm" variant="outline"><Link href={getStationReportHref(row.historiaId)} prefetch={false} target="_blank"><ScrollTextIcon data-icon="inline-start" />Reporte</Link></Button>
                  ) : null}
                  <Button asChild size="sm" variant={completed ? "outline" : "default"}>
                    <Link href={`${basePath}/${encodeURIComponent(row.historiaId)}`}>
                      <ClipboardPenLineIcon data-icon="inline-start" />{completed ? "Editar" : "Registrar"}
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground">
            <SearchXIcon aria-hidden="true" className="size-7" />
            <span className="font-medium text-foreground">No encontramos historias</span>
            <span className="text-sm">{emptyMessage}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{page.rows.length} {page.rows.length === 1 ? "historia visible" : "historias visibles"} · hasta {page.pageSize} por página</p>
        <div className="flex items-center gap-2">
          <Button asChild={Boolean(cursor)} disabled={!cursor} size="sm" variant="outline">
            {cursor ? <Link href={getPageHref({ basePath, cursor: previousCursor, cursors: previousCursors, query })}><ChevronLeftIcon data-icon="inline-start" />Anterior</Link> : <><ChevronLeftIcon data-icon="inline-start" />Anterior</>}
          </Button>
          <Button asChild={page.hasNextPage} disabled={!page.hasNextPage} size="sm" variant="outline">
            {page.hasNextPage && page.nextCursor ? <Link href={getPageHref({ basePath, cursor: page.nextCursor, cursors: nextCursors, query })}>Siguiente<ChevronRightIcon data-icon="inline-end" /></Link> : <>Siguiente<ChevronRightIcon data-icon="inline-end" /></>}
          </Button>
        </div>
      </div>
    </section>
  );
}
