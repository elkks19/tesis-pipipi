"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3Icon,
  CalendarDaysIcon,
  DownloadIcon,
  MapPinIcon,
  PencilIcon,
  ScrollTextIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AuthUserListItem } from "@/lib/auth-users";

import type { ViajeListItem } from "./queries";

type ViajeActionsProps = {
  canEdit: boolean;
  viaje: ViajeListItem;
};

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

function formatOptional(value: string | undefined) {
  return value?.trim() ? value : "Sin registrar";
}

function getPdfHref(viaje: ViajeListItem) {
  return `/admin/viajes/${encodeURIComponent(viaje.docId)}/pdf`;
}

function getEditHref(viaje: ViajeListItem) {
  return `/admin/viajes/${encodeURIComponent(viaje.docId)}/edit`;
}

function getReportHref(viaje: ViajeListItem) {
  return `/admin/viajes/${encodeURIComponent(viaje.docId)}/reporte`;
}

function getPerformanceHref(viaje: ViajeListItem) {
  return `/admin/viajes/${encodeURIComponent(viaje.docId)}/rendimiento`;
}

function getPerformancePdfHref(viaje: ViajeListItem) {
  return `/admin/viajes/${encodeURIComponent(viaje.docId)}/rendimiento/pdf`;
}

function PersonCard({ user, fallbackId }: { user?: AuthUserListItem; fallbackId: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-lg border bg-muted/10 px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRoundIcon className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="break-words text-sm font-medium leading-5">{user?.name ?? "Usuario no encontrado"}</p>
        <p className="mt-0.5 break-all text-xs leading-5 text-muted-foreground">{user?.email ?? fallbackId}</p>
      </div>
    </div>
  );
}

export function ViajeActions({ canEdit, viaje }: ViajeActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <ViajeDetailsDialog canEdit={canEdit} viaje={viaje} />
      {canEdit ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild size="icon-sm" variant="outline">
              <Link href={getEditHref(viaje)}>
                <PencilIcon />
                <span className="sr-only">Editar viaje</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Editar viaje</TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon-sm" variant="outline">
            <Link href={getPdfHref(viaje)}>
              <DownloadIcon />
              <span className="sr-only">Descargar PDF</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Descargar PDF</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon-sm" variant="outline">
            <Link href={getReportHref(viaje)} target="_blank">
              <ScrollTextIcon />
              <span className="sr-only">Ver reporte</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver reporte</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon-sm" variant="outline">
            <Link href={getPerformanceHref(viaje)}>
              <BarChart3Icon />
              <span className="sr-only">Ver rendimiento</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver rendimiento</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon-sm" variant="outline">
            <Link href={getPerformancePdfHref(viaje)} target="_blank">
              <DownloadIcon />
              <span className="sr-only">PDF rendimiento</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>PDF rendimiento</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ViajeDetailsDialog({ canEdit, viaje }: ViajeActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setOpen(true)}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <CalendarDaysIcon />
            <span className="sr-only">Ver detalle</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver detalle</TooltipContent>
      </Tooltip>
      <DialogContent className="grid h-[min(90dvh,900px)] max-h-[calc(100dvh-1.5rem)] w-[min(96vw,1120px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
        <DialogHeader className="border-b bg-muted/20 px-5 py-5 pr-14 text-left sm:px-8 sm:py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Detalle del viaje</p>
          <DialogTitle className="break-words font-heading text-xl sm:text-2xl">{viaje.servicio}</DialogTitle>
          <DialogDescription>
            {viaje.establecimiento.nombre} · Del {formatDate(viaje.fechaEntrada)} al {formatDate(viaje.fechaSalida)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-5 [scrollbar-gutter:stable] sm:px-8 sm:py-6">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-primary/5 px-3 py-1.5 font-medium text-primary"><MapPinIcon className="size-3.5" aria-hidden="true" />{viaje.estaciones.length} estaciones</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/25 px-3 py-1.5 text-muted-foreground"><UsersRoundIcon className="size-3.5" aria-hidden="true" />{new Set(viaje.estaciones.flatMap((estacion) => estacion.estudiantesIds)).size} estudiantes</span>
          </div>
          <div className="grid gap-x-8 gap-y-5 rounded-xl border bg-muted/10 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Fecha de entrada">
              {formatDate(viaje.fechaEntrada)}
            </DetailItem>
            <DetailItem label="Fecha de salida">
              {formatDate(viaje.fechaSalida)}
            </DetailItem>
            <DetailItem label="Establecimiento">
              {viaje.establecimiento.nombre}
            </DetailItem>
            <DetailItem label="Contacto">
              {formatOptional(viaje.establecimiento.contacto)}
            </DetailItem>
            <DetailItem className="sm:col-span-2" label="Dirección">
              {formatOptional(viaje.establecimiento.direccion)}
            </DetailItem>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Estaciones asignadas</h3>
              <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">{viaje.estaciones.length} estaciones</span>
            </div>
            <div className="grid gap-3">
              {viaje.estaciones.map((estacion, index) => (
                <section className="scroll-mt-4 overflow-hidden rounded-xl border bg-background shadow-xs" id={`viaje-estacion-${index}`} key={estacion.tipo}>
                  <div className="flex flex-wrap items-center gap-3 border-b bg-muted/15 px-4 py-3 sm:px-5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span>
                    <h4 className="min-w-0 flex-1 font-semibold">{estacion.tipo}</h4>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {estacion.estudiantesIds.length} estudiante
                      {estacion.estudiantesIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid gap-5 px-4 py-4 text-sm sm:px-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                    <div className="min-w-0">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Docente encargado</p>
                      <PersonCard fallbackId={estacion.docenteEncargadoId} user={estacion.docenteEncargado} />
                    </div>
                    <div className="min-w-0">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estudiantes</p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {estacion.estudiantes.map((student) => <li key={student.id}><PersonCard fallbackId={student.id} user={student} /></li>)}
                        {estacion.estudiantesNoEncontrados.map((id) => <li key={id}><PersonCard fallbackId={id} /></li>)}
                        {estacion.estudiantesIds.length === 0 ? <li className="text-muted-foreground">Sin asignar</li> : null}
                      </ul>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 border-t bg-background px-5 py-4 sm:px-8 [&_a]:w-full sm:[&_a]:w-auto">
          {canEdit ? (
            <Button asChild variant="outline">
              <Link href={getEditHref(viaje)}>
                <PencilIcon data-icon="inline-start" />
                Editar viaje
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href={getPdfHref(viaje)}>
              <DownloadIcon data-icon="inline-start" />
              Descargar PDF
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={getReportHref(viaje)} target="_blank">
              <ScrollTextIcon data-icon="inline-start" />
              Ver reporte
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={getPerformanceHref(viaje)}>
              <BarChart3Icon data-icon="inline-start" />
              Ver rendimiento
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={getPerformancePdfHref(viaje)} target="_blank">
              <DownloadIcon data-icon="inline-start" />
              PDF rendimiento
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={className}>
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
