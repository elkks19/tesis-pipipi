"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3Icon,
  CalendarDaysIcon,
  DownloadIcon,
  PencilIcon,
  ScrollTextIcon,
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
import { Separator } from "@/components/ui/separator";
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

function getUserLabel(user: AuthUserListItem | undefined, fallbackId: string) {
  if (!user) {
    return fallbackId;
  }

  return `${user.name} (${user.email})`;
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
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader className="pr-10">
          <DialogTitle>{viaje.servicio}</DialogTitle>
          <DialogDescription>
            Detalle completo del viaje y sus estaciones configuradas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-5 overflow-y-auto pr-1">
          <div className="grid gap-3 rounded-3xl border bg-muted/20 p-4 sm:grid-cols-2">
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
            <DetailItem className="sm:col-span-2" label="Direccion">
              {formatOptional(viaje.establecimiento.direccion)}
            </DetailItem>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Estaciones</h3>
            <div className="rounded-3xl border">
              {viaje.estaciones.map((estacion, index) => (
                <div className="flex flex-col gap-3 p-4" key={estacion.tipo}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium">{estacion.tipo}</span>
                    <span className="text-xs text-muted-foreground">
                      {estacion.estudiantesIds.length} estudiante
                      {estacion.estudiantesIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span className="min-w-0">
                      Docente:{" "}
                      {getUserLabel(
                        estacion.docenteEncargado,
                        estacion.docenteEncargadoId,
                      )}
                    </span>
                    <span className="min-w-0">
                      Estudiantes:{" "}
                      {[
                        ...estacion.estudiantes.map((student) =>
                          getUserLabel(student, student.id),
                        ),
                        ...estacion.estudiantesNoEncontrados,
                      ].join(", ") || "Sin asignar"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 sm:pt-4 [&_a]:w-full sm:[&_a]:w-auto">
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
