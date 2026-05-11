"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDaysIcon,
  DownloadIcon,
  FileTextIcon,
  PencilIcon,
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
import type { AuthRole } from "@/lib/auth-role-values";
import type { Viaje } from "@/lib/schema/viajes";

type UserListItem = {
  email: string;
  id: string;
  name: string;
  role: AuthRole | null;
};

type ViajeActionItem = Viaje & {
  docId: string;
};

type ViajeActionsProps = {
  canEdit: boolean;
  userById: Record<string, UserListItem>;
  viaje: ViajeActionItem;
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

function getPdfHref(viaje: ViajeActionItem) {
  return `/admin/viajes/${encodeURIComponent(viaje.docId)}/pdf`;
}

function getEditHref(viaje: ViajeActionItem) {
  return `/admin/viajes/${encodeURIComponent(viaje.docId)}/edit`;
}

function getUserLabel(userId: string, userById: Record<string, UserListItem>) {
  const user = userById[userId];

  if (!user) {
    return userId;
  }

  return `${user.name} (${user.email})`;
}

export function ViajeActions({ canEdit, userById, viaje }: ViajeActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <ViajeDetailsDialog canEdit={canEdit} userById={userById} viaje={viaje} />
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
            <Link href="#">
              <FileTextIcon />
              <span className="sr-only">Ver historias</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ver historias</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ViajeDetailsDialog({ canEdit, userById, viaje }: ViajeActionsProps) {
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{viaje.servicio}</DialogTitle>
          <DialogDescription>
            Detalle completo del viaje y sus estaciones configuradas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
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
            <div className="max-h-72 overflow-y-auto rounded-3xl border">
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
                    <span>
                      Docente:{" "}
                      {getUserLabel(estacion.docenteEncargadoId, userById)}
                    </span>
                    <span>
                      Estudiantes:{" "}
                      {estacion.estudiantesIds
                        .map((studentId) => getUserLabel(studentId, userById))
                        .join(", ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
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
            <Link href="#">
              <FileTextIcon data-icon="inline-start" />
              Ver historias
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
