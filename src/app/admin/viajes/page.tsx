import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDaysIcon, MapPinIcon, PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { listViajes } from "./queries";

export const metadata: Metadata = {
  title: "Viajes",
};

type ViajesPageProps = {
  searchParams: Promise<{
    desde?: string | string[];
    hasta?: string | string[];
    lugar?: string | string[];
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

export default async function ViajesPage({ searchParams }: ViajesPageProps) {
  const params = await searchParams;
  const filters = {
    fechaDesde: getParam(params.desde),
    fechaHasta: getParam(params.hasta),
    lugar: getParam(params.lugar),
  };
  const viajes = await listViajes(filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Viajes</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Listado de viajes programados y estaciones asignadas.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/viajes/create">
            <PlusIcon data-icon="inline-start" />
            Crear viaje
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
        <form className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto_auto]" method="get">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="lugar">
              Lugar o establecimiento
            </label>
            <div className="relative">
              <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                defaultValue={filters.lugar}
                id="lugar"
                name="lugar"
                placeholder="Municipio, establecimiento o servicio"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="desde">
              Desde
            </label>
            <Input
              defaultValue={filters.fechaDesde}
              id="desde"
              name="desde"
              type="date"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="hasta">
              Hasta
            </label>
            <Input
              defaultValue={filters.fechaHasta}
              id="hasta"
              name="hasta"
              type="date"
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" type="submit">
              <SearchIcon data-icon="inline-start" />
              Filtrar
            </Button>
          </div>
          <div className="flex items-end">
            <Button asChild className="w-full" variant="outline">
              <Link href="/admin/viajes">Limpiar</Link>
            </Button>
          </div>
        </form>

        <div className="overflow-hidden rounded-3xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead>Lugar</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Estaciones</TableHead>
                <TableHead>Equipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viajes.length > 0 ? (
                viajes.map((viaje) => {
                  const estudiantes = new Set(
                    viaje.estaciones.flatMap((estacion) => estacion.estudiantesIds),
                  );

                  return (
                    <TableRow key={viaje.docId}>
                      <TableCell className="font-medium">
                        {viaje.servicio}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-56 flex-col gap-1">
                          <span>{viaje.establecimiento.nombre}</span>
                          {viaje.establecimiento.direccion ? (
                            <span className="text-xs text-muted-foreground">
                              {viaje.establecimiento.direccion}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarDaysIcon />
                          <span>
                            {formatDate(viaje.fechaEntrada)} -{" "}
                            {formatDate(viaje.fechaSalida)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{viaje.estaciones.length}</TableCell>
                      <TableCell>
                        {estudiantes.size} estudiantes /{" "}
                        {viaje.estaciones.length} docentes
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    className="h-28 text-center text-muted-foreground"
                    colSpan={5}
                  >
                    No hay viajes que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-sm text-muted-foreground">
          Mostrando {viajes.length} viaje{viajes.length === 1 ? "" : "s"}.
        </p>
      </div>
    </div>
  );
}
