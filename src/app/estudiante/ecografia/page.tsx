import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardPenLineIcon,
  IdCardIcon,
  ImagePlusIcon,
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

import { HistoriasFilters } from "./historias-filters";
import { listHistoriasForEcografia } from "./queries";

export const metadata: Metadata = {
  title: "Ecografia",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EcografiaPageProps = {
  searchParams: Promise<{
    cursor?: string | string[];
    cursors?: string | string[];
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

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
  cursor,
  cursors,
  query,
}: {
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

  return search ? `/estudiante/ecografia?${search}` : "/estudiante/ecografia";
}

export default async function EcografiaPage({
  searchParams,
}: EcografiaPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const previousCursors = cursors.slice(0, -1);
  const previousCursor = previousCursors.at(-1);
  const historiasPage = await listHistoriasForEcografia({
    cursor,
    query,
  });
  const nextCursors = cursor ? [...cursors, cursor] : cursors;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Ecografia</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecciona una historia con ecografia solicitada y registra sus
          hallazgos junto a la fotografia del estudio.
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
        <HistoriasFilters query={query} />

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
              {historiasPage.rows.length > 0 ? (
                historiasPage.rows.map((row) => {
                  const datos = row.paciente.datosPersonales;

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
                          <ImagePlusIcon />
                          <span>Pendiente</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/estudiante/ecografia/${encodeURIComponent(
                                row.historiaId,
                              )}`}
                            >
                              <ClipboardPenLineIcon data-icon="inline-start" />
                              Registrar
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
                    No hay historias con ecografia solicitada pendientes de
                    registro que coincidan con la busqueda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {historiasPage.rows.length} de hasta{" "}
            {historiasPage.pageSize} historias por pagina.
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
              asChild={historiasPage.hasNextPage}
              disabled={!historiasPage.hasNextPage}
              size="sm"
              variant="outline"
            >
              {historiasPage.hasNextPage && historiasPage.nextCursor ? (
                <Link
                  href={getPageHref({
                    cursor: historiasPage.nextCursor,
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
    </div>
  );
}
