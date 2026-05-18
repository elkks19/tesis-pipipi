import Link from "next/link";
import type { ReactNode } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardPenLineIcon,
  IdCardIcon,
  ScrollTextIcon,
  UserRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { StationKey } from "@/lib/station-histories";

import { StationHistoriasFilters } from "./station-historias-filters";
import type { StationHistoryPageResult } from "../_lib/station-history-queries";

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
  const { nombres, apellidoPaterno, apellidoMaterno } =
    paciente.datosPersonales;

  return [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ");
}

function formatDate(value: string) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getPlace(paciente: PacienteSearchResult) {
  return [
    paciente.lugarNacimiento.distrito,
    paciente.lugarNacimiento.departamento,
    paciente.lugarNacimiento.pais,
  ]
    .filter(Boolean)
    .join(", ");
}

function getPageHref({
  basePath,
  cursor,
  cursors,
  query,
}: {
  basePath: string;
  cursor?: string;
  cursors: string[];
  query: string;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (cursors.length > 0) {
    params.set("cursors", cursors.join(","));
  }

  const search = params.toString();

  return search ? `${basePath}?${search}` : basePath;
}

function getStationReportHref({
  historiaId,
}: {
  historiaId: string;
}) {
  const params = new URLSearchParams({
    at: String(Date.now()),
  });

  return `/reportes/historias/${encodeURIComponent(historiaId)}?${params}`;
}

export function PendingHistoriesTable({
  basePath,
  cursor,
  cursors,
  emptyMessage,
  filterId,
  mode = "estudiante",
  page,
  query,
  stationKey,
  statusIcon,
  statusLabel = mode === "docente" ? "Registrado" : "Pendiente",
}: PendingHistoriesTableProps) {
  const previousCursor = cursors.at(-1);
  const previousCursors = cursors.slice(0, -1);
  const nextCursors = cursor ? [...cursors, cursor] : cursors;

  return (
    <div className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
      <StationHistoriasFilters id={filterId} query={query} />

      <div className="overflow-hidden rounded-3xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Nacimiento</TableHead>
              <TableHead>Lugar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.rows.length > 0 ? (
              page.rows.map((row) => {
                const datos = row.paciente.datosPersonales;
                const rowStatusLabel =
                  mode === "docente"
                    ? row.stationCompleted
                      ? "Registrado"
                      : "Pendiente"
                    : statusLabel;

                return (
                  <TableRow key={row.historiaId}>
                    <TableCell className="font-medium">
                      <div className="flex min-w-56 items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                          <UserRoundIcon />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">
                            {getPacienteName(row.paciente)}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {row.paciente.genero}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <IdCardIcon />
                        <span>
                          {datos.documentoIdentidad}{" "}
                          {datos.numeroDocumentoIdentidad}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(datos.fechaNacimiento)}</TableCell>
                    <TableCell>
                      <span className="block min-w-48 truncate">
                        {getPlace(row.paciente) || "Sin lugar"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon}
                        <span>{rowStatusLabel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {mode === "docente" ? (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={getStationReportHref({
                                historiaId: row.historiaId,
                              })}
                              prefetch={false}
                              target="_blank"
                            >
                              <ScrollTextIcon data-icon="inline-start" />
                              Reporte
                            </Link>
                          </Button>
                        ) : null}
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`${basePath}/${encodeURIComponent(
                              row.historiaId,
                            )}`}
                          >
                            <ClipboardPenLineIcon data-icon="inline-start" />
                            {mode === "docente" && row.stationCompleted
                              ? "Editar"
                              : "Registrar"}
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  className="h-28 text-center text-muted-foreground"
                  colSpan={6}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando {page.rows.length} de hasta {page.pageSize} historias por
          pagina.
        </p>
        <div className="flex items-center gap-2">
          <Button
            asChild={Boolean(cursor)}
            disabled={!cursor}
            size="sm"
            variant="outline"
          >
            {cursor ? (
              <Link
                href={getPageHref({
                  basePath,
                  cursor: previousCursor,
                  cursors: previousCursors,
                  query,
                })}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                Anterior
              </Link>
            ) : (
              <>
                <ChevronLeftIcon data-icon="inline-start" />
                Anterior
              </>
            )}
          </Button>
          <Button
            asChild={page.hasNextPage}
            disabled={!page.hasNextPage}
            size="sm"
            variant="outline"
          >
            {page.hasNextPage && page.nextCursor ? (
              <Link
                href={getPageHref({
                  basePath,
                  cursor: page.nextCursor,
                  cursors: nextCursors,
                  query,
                })}
              >
                Siguiente
                <ChevronRightIcon data-icon="inline-end" />
              </Link>
            ) : (
              <>
                Siguiente
                <ChevronRightIcon data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
