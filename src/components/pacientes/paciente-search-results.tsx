"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FilePlus2Icon,
  IdCardIcon,
  InfoIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
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
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
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
) {
  const params = new URLSearchParams({
    pacienteId,
  });

  if (query) {
    params.set("q", query);
  }

  return `${createHistoriaRoute}?${params.toString()}`;
}

function getInitials(paciente: PacienteSearchResult) {
  const { nombres, apellidoPaterno } = paciente.datosPersonales;
  const first = nombres?.charAt(0) ?? "";
  const last = apellidoPaterno?.charAt(0) ?? "";

  return (first + last).toUpperCase() || "?";
}

function DetailField({ label, value }: { label: string; value?: string }) {
  const isEmpty = !value || value === "Sin registro";

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm leading-snug ${isEmpty ? "text-muted-foreground/60 italic" : "font-medium"}`}>
        {isEmpty ? "Sin registro" : value}
      </span>
    </div>
  );
}

function PacienteDetailContent({
  historias = [],
  paciente,
}: {
  historias?: HistoriaWithId[];
  paciente: PacienteSearchResult;
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
    <div className="flex flex-col gap-5">
      {/* Patient identity header */}
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {getInitials(paciente)}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-base font-semibold">{name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {datos.documentoIdentidad} {datos.numeroDocumentoIdentidad}
          </p>
        </div>
      </div>

      <Separator />

      {/* Personal data section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IdCardIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Datos personales</h3>
        </div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <DetailField label="Fecha de nacimiento" value={datos.fechaNacimiento} />
          <DetailField label="Genero" value={paciente.genero} />
          <DetailField label="Nacionalidad" value={paciente.nacionalidad} />
          <DetailField label="Etnia" value={paciente.etnia} />
        </div>
      </section>

      {/* Location section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <MapPinIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Lugar de nacimiento</h3>
        </div>
        {lugarNacimiento ? (
          <p className="text-sm">{lugarNacimiento}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground/60">Sin registro</p>
        )}
      </section>

      <PacienteClinicalSummaryPreview
        paciente={paciente}
        previousHistorias={historias}
      />

      <Separator />

      {/* Parents/guardians section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Padres o responsables</h3>
          {paciente.padres?.length ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {paciente.padres.length}
            </span>
          ) : null}
        </div>
        {paciente.padres?.length ? (
          <div className="flex flex-col gap-3">
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
                  className="flex flex-col gap-3 rounded-2xl border p-3"
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
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed py-4 text-center">
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
}: {
  historias?: HistoriaWithId[];
  paciente: PacienteSearchResult;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const name = getPacienteName(paciente);

  if (isMobile) {
    return (
      <>
        <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
          <InfoIcon data-icon="inline-start" />
          Detalle
        </Button>
        <Sheet onOpenChange={setOpen} open={open}>
          <SheetContent className="max-h-[94svh] overflow-y-auto" side="bottom">
            <SheetHeader>
              <SheetTitle>{name}</SheetTitle>
              <SheetDescription>
                Informacion registrada del paciente.
              </SheetDescription>
            </SheetHeader>
            <div className="px-6 pb-6">
              <PacienteDetailContent historias={historias} paciente={paciente} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
        <InfoIcon data-icon="inline-start" />
        Detalle
      </Button>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[78rem]">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            Informacion registrada del paciente.
          </DialogDescription>
        </DialogHeader>
        <PacienteDetailContent historias={historias} paciente={paciente} />
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
}: PacienteSearchResultsProps) {
  if (!query && pacientes.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-background px-6 py-8 text-center">
        <SearchIcon className="text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Busca un paciente</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Usa numero de documento, nombres o apellidos para encontrar el
            registro antes de crear la historia.
          </p>
        </div>
        O
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
    <ItemGroup>
      {pacientes.map((paciente) => {
        const datos = paciente.datosPersonales;
        const isSelected = paciente.id === selectedPacienteId;
        const historias = historiasByPacienteId?.[paciente.id] ?? [];

        return (
          <Item
            className="bg-background"
            key={paciente.id}
            variant={isSelected ? "muted" : "outline"}
          >
            <ItemMedia variant="icon">
              <UserRoundIcon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{getPacienteName(paciente)}</ItemTitle>
              <ItemDescription>
                {datos.documentoIdentidad} {datos.numeroDocumentoIdentidad}
                {" · "}
                {paciente.genero}
                {" · "}
                {paciente.lugarNacimiento.departamento}
              </ItemDescription>
            </ItemContent>
            <ItemContent className="hidden flex-none md:flex">
              <ItemTitle className="text-xs text-muted-foreground">
                <IdCardIcon />
                {datos.fechaNacimiento || "Sin fecha"}
              </ItemTitle>
              <ItemDescription>
                <MapPinIcon />
                {[paciente.lugarNacimiento.distrito, paciente.nacionalidad]
                  .filter(Boolean)
                  .join(" · ")}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="basis-full justify-end sm:basis-auto">
              <PacienteClinicalSummaryModal
                paciente={paciente}
                previousHistorias={historias}
                triggerLabel="Resumen clinico"
              />
              <PacienteDetailDialog historias={historias} paciente={paciente} />
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`${editPacienteRoute}/${encodeURIComponent(paciente.id)}/edit`}
                >
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
