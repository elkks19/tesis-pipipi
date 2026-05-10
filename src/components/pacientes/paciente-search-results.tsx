"use client";

import Link from "next/link";
import {
  FilePlus2Icon,
  IdCardIcon,
  InfoIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  UserRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";

type PacienteSearchResultsProps = {
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

function createHistoriaHref(pacienteId: string, query: string) {
  const params = new URLSearchParams({
    pacienteId,
  });

  if (query) {
    params.set("q", query);
  }

  return `/estudiante/anamnesis/create-historia?${params.toString()}`;
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "Sin registro"}</span>
    </div>
  );
}

function PacienteDetailDialog({
  paciente,
}: {
  paciente: PacienteSearchResult;
}) {
  const datos = paciente.datosPersonales;
  const name = getPacienteName(paciente);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <InfoIcon data-icon="inline-start" />
          Detalle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            Informacion completa registrada para este paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow
            label="Documento"
            value={`${datos.documentoIdentidad} ${datos.numeroDocumentoIdentidad}`}
          />
          <DetailRow label="Fecha de nacimiento" value={datos.fechaNacimiento} />
          <DetailRow label="Genero" value={paciente.genero} />
          <DetailRow label="Nacionalidad" value={paciente.nacionalidad} />
          <DetailRow
            label="Lugar de nacimiento"
            value={[
              paciente.lugarNacimiento.distrito,
              paciente.lugarNacimiento.departamento,
              paciente.lugarNacimiento.pais,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          <DetailRow label="Etnia" value={paciente.etnia} />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Padres o responsables</h3>
          {paciente.padres?.length ? (
            <div className="grid gap-3">
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
                    className="grid gap-3 rounded-3xl border bg-background p-3 sm:grid-cols-2"
                    key={`${padre.relacion}-${index}`}
                  >
                    <DetailRow label="Nombre" value={padreName} />
                    <DetailRow label="Relacion" value={padre.relacion} />
                    <DetailRow
                      label="Documento"
                      value={`${padre.datosPersonales.documentoIdentidad} ${padre.datosPersonales.numeroDocumentoIdentidad}`}
                    />
                    <DetailRow label="Contacto" value={padre.numeroContacto} />
                    <DetailRow
                      label="Asume sustento"
                      value={padre.asumeSustento ? "Si" : "No"}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              No hay responsables registrados.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PacienteSearchResults({
  pacientes,
  query,
  selectedPacienteId,
  newPacienteRoute,
}: PacienteSearchResultsProps) {
  if (!query) {
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
              <PacienteDetailDialog paciente={paciente} />
              <Button asChild size="sm">
                <Link href={createHistoriaHref(paciente.id, query)}>
                  <FilePlus2Icon data-icon="inline-start" />
                  Crear historia
                </Link>
              </Button>
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
