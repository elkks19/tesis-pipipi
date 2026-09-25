"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClockIcon,
  Clock3Icon,
  FilePlus2Icon,
  IdCardIcon,
  InfoIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  PacienteClinicalSummaryModal,
  PacienteClinicalSummaryPreview,
} from "@/components/historias/historia-clinical-summary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia } from "@/lib/schema/historia";

type HistoriaWithId = Historia & {
  _id?: string;
};

type PacienteSearchResultsProps = {
  createHistoriaRoute?: string;
  editPacienteRoute?: string;
  hideCreateHistoriaAction?: boolean;
  historiasByPacienteId?: Record<string, HistoriaWithId[]>;
  pacientes: PacienteSearchResult[];
  query: string;
  newPacienteRoute: string;
  selectedPacienteId?: string;
  page?: number;
};

function getPacienteName(paciente: PacienteSearchResult) {
  const { nombres, apellidoPaterno, apellidoMaterno } =
    paciente.datosPersonales;

  return [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ");
}

function createHistoriaHref(
  pacienteId: string,
  query: string,
  createHistoriaRoute: string,
  page: number,
) {
  const params = new URLSearchParams({
    pacienteId,
  });

  if (query) {
    params.set("q", query);
  }
  if (page > 1) params.set("page", String(page));

  return `${createHistoriaRoute}?${params.toString()}`;
}

function getInitials(paciente: PacienteSearchResult) {
  const { nombres, apellidoPaterno } = paciente.datosPersonales;
  const first = nombres?.charAt(0) ?? "";
  const last = apellidoPaterno?.charAt(0) ?? "";

  return (first + last).toUpperCase() || "?";
}

function formatDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value,
  );

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "long",
    timeZone: "America/La_Paz",
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(date);
}

function DetailField({ label, value }: { label: string; value?: string }) {
  const isEmpty = !value || value === "Sin registro";

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-muted/35 px-3 py-2.5">
      <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm leading-snug ${isEmpty ? "text-muted-foreground/60 italic" : "font-medium"}`}>
        {isEmpty ? "Sin registro" : value}
      </span>
    </div>
  );
}

function PacienteDetailContent({
  historias = [],
  paciente,
  editPacienteRoute,
}: {
  historias?: HistoriaWithId[];
  paciente: PacienteSearchResult;
  editPacienteRoute: string;
}) {
  const datos = paciente.datosPersonales;
  const name = getPacienteName(paciente);
  const lugarNacimiento = [
    paciente.lugarNacimiento.distrito,
    paciente.lugarNacimiento.departamento,
    paciente.lugarNacimiento.pais,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.04]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
              {getInitials(paciente)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <IdCardIcon className="size-3.5" />
                  {datos.documentoIdentidad} {datos.numeroDocumentoIdentidad}
                </span>
                <span>{paciente.genero}</span>
              </div>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="w-full bg-background sm:w-auto">
            <Link href={`${editPacienteRoute}/${encodeURIComponent(paciente.id)}/edit`}>
              <PencilIcon data-icon="inline-start" />
              Editar paciente
            </Link>
          </Button>
        </div>
        <div className="grid border-t border-primary/15 sm:grid-cols-3 sm:divide-x sm:divide-primary/15">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <CalendarClockIcon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Registrado</p>
              <p className="truncate text-sm font-medium">{formatDateTime(paciente.createdAt) ?? "Fecha no registrada"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 border-t border-primary/15 px-4 py-3 sm:border-t-0">
            <Clock3Icon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Última actualización</p>
              <p className="truncate text-sm font-medium">{formatDateTime(paciente.updatedAt) ?? "Sin actualizaciones"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 border-t border-primary/15 px-4 py-3 sm:border-t-0">
            <FilePlus2Icon className="size-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Historias clínicas</p>
              <p className="text-sm font-medium">{historias.length} {historias.length === 1 ? "registro" : "registros"}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-2xl border p-4">
          <div className="mb-3 flex items-center gap-2">
            <IdCardIcon className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Datos personales</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailField label="Fecha de nacimiento" value={formatDate(datos.fechaNacimiento)} />
            <DetailField label="Género" value={paciente.genero} />
            <DetailField label="Nacionalidad" value={paciente.nacionalidad} />
            <DetailField label="Etnia" value={paciente.etnia} />
          </div>
        </section>

        <section className="rounded-2xl border p-4">
          <div className="mb-3 flex items-center gap-2">
            <MapPinIcon className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Lugar de nacimiento</h3>
          </div>
          <div className="flex min-h-24 items-center gap-3 rounded-xl bg-muted/35 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPinIcon className="size-4" />
            </div>
            <p className={`text-sm leading-relaxed ${lugarNacimiento ? "font-medium" : "italic text-muted-foreground/60"}`}>
              {lugarNacimiento || "Sin registro"}
            </p>
          </div>
        </section>
      </div>

      <PacienteClinicalSummaryPreview
        paciente={paciente}
        previousHistorias={historias}
      />

      <section className="flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex items-center gap-2">
          <UsersIcon className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Padres o responsables</h3>
          {paciente.padres?.length ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {paciente.padres.length}
            </span>
          ) : null}
        </div>
        {paciente.padres?.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {paciente.padres.map((padre, index) => {
              const padreName = [
                padre.datosPersonales.nombres,
                padre.datosPersonales.apellidoPaterno,
                padre.datosPersonales.apellidoMaterno,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3"
                  key={`${padre.relacion}-${index}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{padreName || "Sin nombre"}</p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {padre.relacion || "Responsable"}
                    </span>
                  </div>
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <DetailField
                      label="Documento"
                      value={
                        padre.datosPersonales.numeroDocumentoIdentidad
                          ? `${padre.datosPersonales.documentoIdentidad} ${padre.datosPersonales.numeroDocumentoIdentidad}`
                          : undefined
                      }
                    />
                    <DetailField label="Contacto" value={padre.numeroContacto} />
                    <DetailField
                      label="Asume sustento"
                      value={padre.asumeSustento ? "Si" : "No"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed py-4 text-center">
            <UsersIcon className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay responsables registrados.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function PacienteDetailDialog({
  historias = [],
  paciente,
  editPacienteRoute,
}: {
  historias?: HistoriaWithId[];
  paciente: PacienteSearchResult;
  editPacienteRoute: string;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const name = getPacienteName(paciente);

  if (isMobile) {
    return (
      <>
        <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline" aria-label={`Ver detalle de ${name}`}>
          <InfoIcon data-icon="inline-start" />
          Detalle
        </Button>
        <Sheet onOpenChange={setOpen} open={open}>
          <SheetContent className="max-h-[94svh] overflow-y-auto p-0" side="bottom">
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>Detalle del paciente</SheetTitle>
              <SheetDescription>
                {name} · Información registrada.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 py-4 sm:px-6">
              <PacienteDetailContent historias={historias} paciente={paciente} editPacienteRoute={editPacienteRoute} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline" aria-label={`Ver detalle de ${name}`}>
        <InfoIcon data-icon="inline-start" />
        Detalle
      </Button>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-5 text-left">
          <DialogTitle>Detalle del paciente</DialogTitle>
          <DialogDescription>
            {name} · Información registrada.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          <PacienteDetailContent historias={historias} paciente={paciente} editPacienteRoute={editPacienteRoute} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PacienteSearchResults({
  createHistoriaRoute = "/estudiante/anamnesis/create-historia",
  editPacienteRoute = "/estudiante/anamnesis/pacientes",
  hideCreateHistoriaAction = false,
  historiasByPacienteId,
  pacientes,
  query,
  selectedPacienteId,
  newPacienteRoute,
  page = 1,
}: PacienteSearchResultsProps) {
  if (!query && pacientes.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-background px-6 py-8 text-center">
        <UserRoundIcon className="text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{page > 1 ? "No hay pacientes en esta página" : "Aún no hay pacientes registrados"}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {page > 1 ? "Vuelve a la página anterior para continuar." : "Registra un paciente para comenzar su historia clínica."}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={newPacienteRoute}>
            <PlusIcon data-icon="inline-start" />
            Crea un nuevo paciente
          </Link>
        </Button>
      </div>
    );
  }

  if (!pacientes.length) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-background px-6 py-8 text-center">
        <UserRoundIcon className="text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Sin resultados</p>
          <p className="max-w-md text-sm text-muted-foreground">
            No encontramos pacientes que coincidan con &quot;{query}&quot;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ItemGroup className="@container gap-3">
      {pacientes.map((paciente) => {
        const datos = paciente.datosPersonales;
        const isSelected = paciente.id === selectedPacienteId;
        const historias = historiasByPacienteId?.[paciente.id] ?? [];

        return (
          <Item
            className="grid min-w-0 grid-cols-1 items-center gap-x-5 gap-y-3 bg-background @min-[560px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @min-[1100px]:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto]"
            role="listitem"
            key={paciente.id}
            variant={isSelected ? "muted" : "outline"}
          >
            <ItemContent className="min-w-0 gap-1.5">
              <ItemTitle className="line-clamp-none w-auto break-words">
                {getPacienteName(paciente)}
              </ItemTitle>
              <ItemDescription className="line-clamp-none break-words">
                {datos.documentoIdentidad} {datos.numeroDocumentoIdentidad}
              </ItemDescription>
              <p className="break-words text-xs text-muted-foreground">
                {paciente.genero}
              </p>
            </ItemContent>
            <dl className="grid min-w-0 grid-cols-2 gap-3 @min-[560px]:grid-cols-1 @min-[560px]:gap-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Nacimiento</dt>
                <dd className="mt-0.5 text-sm">
                  {datos.fechaNacimiento ? datos.fechaNacimiento.split("-").reverse().join("/") : "Sin fecha"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Procedencia</dt>
                <dd className="mt-0.5 break-words text-sm">
                  {[paciente.lugarNacimiento.distrito, paciente.lugarNacimiento.departamento].filter(Boolean).join(" · ") || "Sin registro"}
                </dd>
              </div>
            </dl>
            <ItemActions className="flex-wrap justify-start gap-2 @min-[560px]:col-span-2 @min-[1100px]:col-span-1 @min-[1100px]:justify-end">
              <PacienteClinicalSummaryModal paciente={paciente} previousHistorias={historias} triggerLabel="Resumen clínico" />
              <PacienteDetailDialog historias={historias} paciente={paciente} editPacienteRoute={editPacienteRoute} />
              <Button asChild size="sm" variant="outline">
                <Link href={`${editPacienteRoute}/${encodeURIComponent(paciente.id)}/edit`}>
                  <PencilIcon data-icon="inline-start" />
                  Editar
                </Link>
              </Button>
              {!hideCreateHistoriaAction ? (
                <Button asChild size="sm">
                  <Link
                    href={createHistoriaHref(
                      paciente.id,
                      query,
                      createHistoriaRoute,
                      page,
                    )}
                  >
                    <FilePlus2Icon data-icon="inline-start" />
                    Crear historia
                  </Link>
                </Button>
              ) : null}
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
