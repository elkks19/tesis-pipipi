import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDaysIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuthUsers } from "@/lib/auth-users";

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
  return new Date().toISOString().slice(0, 10);
}

function canEditViaje(fechaEntrada: string) {
  return fechaEntrada > getTodayValue();
}

export default async function ViajesPage({ searchParams }: ViajesPageProps) {
  const params = await searchParams;
  const filters = {
    fechaDesde: getParam(params.desde) || getParam(params.fecha),
    fechaHasta: getParam(params.hasta) || getParam(params.fecha),
    lugar: getParam(params.lugar),
  };
  const viajes = await listViajes(filters);
  const users = listAuthUsers();
  const userById = Object.fromEntries(users.map((user) => [user.id, user]));

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
        <ViajesFilters filters={filters} />

        <div className="overflow-hidden rounded-3xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead>Lugar</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Estaciones</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
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
                      <TableCell>
                        <ViajeActions
                          canEdit={canEditViaje(viaje.fechaEntrada)}
                          userById={userById}
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
                    colSpan={6}
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
