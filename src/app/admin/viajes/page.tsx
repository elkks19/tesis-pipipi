import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon, PlusIcon, UsersRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { listViajes } from "./queries";
import { ViajeActions } from "./viaje-actions";
import { ViajesFilters } from "./viajes-filters";

export const metadata: Metadata = {
  title: "Viajes",
};

type ViajesPageProps = {
  searchParams: Promise<{
    desde?: string | string[];
    fecha?: string | string[];
    hasta?: string | string[];
    lugar?: string | string[];
    page?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string) {
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

function getTodayValue() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const PAGE_SIZE = 8;

function getPageHref(filters: { fechaDesde: string; fechaHasta: string; lugar: string }, page: number) {
  const params = new URLSearchParams();
  if (filters.lugar) params.set("lugar", filters.lugar);
  if (filters.fechaDesde) params.set("desde", filters.fechaDesde);
  if (filters.fechaHasta) params.set("hasta", filters.fechaHasta);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/viajes?${query}` : "/admin/viajes";
}

function canEditViaje(fechaEntrada: string) {
  return fechaEntrada > getTodayValue();
}

function getTeamSummary(viaje: Awaited<ReturnType<typeof listViajes>>[number]) {
  const docentes = viaje.estaciones.map(
    (estacion) =>
      estacion.docenteEncargado?.name ?? estacion.docenteEncargadoId,
  );
  const estudiantes = [
    ...new Set(
      viaje.estaciones.flatMap((estacion) => [
        ...estacion.estudiantes.map((student) => student.name),
        ...estacion.estudiantesNoEncontrados,
      ]),
    ),
  ];

  return {
    docentes,
    estudiantes,
  };
}

function joinLimitedPreview(users: string[], limit: number) {
  if (users.length === 0) {
    return "Sin asignar";
  }

  const visibleUsers = users.slice(0, limit).join(", ");
  const hiddenCount = users.length - limit;

  return hiddenCount > 0 ? `${visibleUsers} y ${hiddenCount} más` : visibleUsers;
}

function StationChips({
  limit,
  viaje,
}: {
  limit: number;
  viaje: Awaited<ReturnType<typeof listViajes>>[number];
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {viaje.estaciones.slice(0, limit).map((estacion) => (
        <span
          className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] leading-5 text-muted-foreground"
          key={estacion.tipo}
        >
          {estacion.tipo}
        </span>
      ))}
      {viaje.estaciones.length > limit ? (
        <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] leading-5 text-muted-foreground">
          +{viaje.estaciones.length - limit}
        </span>
      ) : null}
    </div>
  );
}

export default async function ViajesPage({ searchParams }: ViajesPageProps) {
  const params = await searchParams;
  const filters = {
    fechaDesde: getParam(params.desde) || getParam(params.fecha),
    fechaHasta: getParam(params.hasta) || getParam(params.fecha),
    lugar: getParam(params.lugar),
  };
  const viajes = await listViajes(filters);
  const requestedPage = Number(getParam(params.page));
  const totalPages = Math.max(1, Math.ceil(viajes.length / PAGE_SIZE));
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  const visibleViajes = viajes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalStations = viajes.reduce(
    (total, viaje) => total + viaje.estaciones.length,
    0,
  );
  const totalStudents = viajes.reduce(
    (total, viaje) => total + viaje.resumenEquipo.estudiantesAsignados,
    0,
  );
  const totalTeachers = viajes.reduce(
    (total, viaje) => total + viaje.resumenEquipo.docentesAsignados,
    0,
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administración · Coordinación</p>
          <h1 className="font-heading text-2xl font-semibold">Viajes</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Organiza los viajes, consulta sus equipos y revisa las estaciones asignadas.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/viajes/create">
            <PlusIcon data-icon="inline-start" />
            Crear viaje
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-5 rounded-xl border bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2 border-b pb-4 text-xs text-muted-foreground sm:gap-3">
          <span className="rounded-full border bg-muted/30 px-3 py-1.5"><strong className="text-foreground">{viajes.length}</strong> viajes encontrados</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1.5"><MapPinIcon className="size-3.5" />{totalStations} estaciones</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1.5"><UsersRoundIcon className="size-3.5" />{totalStudents} estudiantes asignados</span>
        </div>
        <ViajesFilters filters={filters} />

        <div className="flex flex-col gap-3 md:hidden">
          {visibleViajes.length > 0 ? (
            visibleViajes.map((viaje) => {
              const team = getTeamSummary(viaje);

              return (
                <Card className="rounded-xl shadow-sm" key={viaje.docId} size="sm">
                  <CardHeader>
                    <CardTitle className="truncate">{viaje.servicio}</CardTitle>
                    <CardDescription className="flex min-w-0 flex-col gap-1">
                      <span className="truncate">
                        {viaje.establecimiento.nombre}
                      </span>
                      {viaje.establecimiento.direccion ? (
                        <span className="line-clamp-1 text-xs">
                          {viaje.establecimiento.direccion}
                        </span>
                      ) : null}
                    </CardDescription>
                    <CardAction>
                      <ViajeActions
                        canEdit={canEditViaje(viaje.fechaEntrada)}
                        viaje={viaje}
                      />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-start gap-2 text-sm">
                      <CalendarDaysIcon />
                      <div className="flex min-w-0 flex-col">
                        <span>{formatDate(viaje.fechaEntrada)}</span>
                        <span className="text-muted-foreground">
                          {formatDate(viaje.fechaSalida)}
                        </span>
                      </div>
                    </div>
                    <StationChips limit={4} viaje={viaje} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-medium">
                        {team.estudiantes.length} estudiantes /{" "}
                        {team.docentes.length} docentes
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        Docentes: {joinLimitedPreview(team.docentes, 2)}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        Estudiantes: {joinLimitedPreview(team.estudiantes, 3)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No hay viajes que coincidan con los filtros.
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-xl border md:block">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[34%]">Viaje</TableHead>
                <TableHead className="w-[20%]">Fechas</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleViajes.length > 0 ? (
                visibleViajes.map((viaje) => {
                  const team = getTeamSummary(viaje);

                  return (
                    <TableRow key={viaje.docId}>
                      <TableCell className="align-top">
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="truncate font-medium">
                              {viaje.servicio}
                            </span>
                            <span className="truncate text-sm text-muted-foreground">
                              {viaje.establecimiento.nombre}
                            </span>
                          </div>
                          {viaje.establecimiento.direccion ? (
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {viaje.establecimiento.direccion}
                            </span>
                          ) : null}
                          <StationChips limit={3} viaje={viaje} />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex min-w-0 items-start gap-2">
                          <CalendarDaysIcon />
                          <div className="flex min-w-0 flex-col gap-1 text-sm">
                            <span className="truncate">
                              {formatDate(viaje.fechaEntrada)}
                            </span>
                            <span className="truncate text-muted-foreground">
                              {formatDate(viaje.fechaSalida)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-medium">
                            {team.estudiantes.length} estudiantes /{" "}
                            {team.docentes.length} docentes
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            Docentes: {joinLimitedPreview(team.docentes, 2)}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            Estudiantes:{" "}
                            {joinLimitedPreview(team.estudiantes, 3)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <ViajeActions
                          canEdit={canEditViaje(viaje.fechaEntrada)}
                          viaje={viaje}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    className="h-28 text-center text-muted-foreground"
                    colSpan={4}
                  >
                    No hay viajes que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            {viajes.length === 0 ? "Sin resultados" : `Mostrando ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, viajes.length)} de ${viajes.length} viajes`}
            <span className="ml-2 text-xs">· {totalTeachers} docentes asignados</span>
          </p>
          <nav aria-label="Páginas de viajes" className="flex items-center gap-2">
            <Button asChild={currentPage > 1} disabled={currentPage <= 1} size="sm" variant="outline">
              {currentPage > 1 ? <Link href={getPageHref(filters, currentPage - 1)}><ChevronLeftIcon data-icon="inline-start" />Anterior</Link> : <><ChevronLeftIcon data-icon="inline-start" />Anterior</>}
            </Button>
            <span className="min-w-20 text-center text-xs tabular-nums text-muted-foreground">{currentPage} de {totalPages}</span>
            <Button asChild={currentPage < totalPages} disabled={currentPage >= totalPages} size="sm" variant="outline">
              {currentPage < totalPages ? <Link href={getPageHref(filters, currentPage + 1)}>Siguiente<ChevronRightIcon data-icon="inline-end" /></Link> : <>Siguiente<ChevronRightIcon data-icon="inline-end" /></>}
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}
