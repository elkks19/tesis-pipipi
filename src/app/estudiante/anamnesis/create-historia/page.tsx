import type { Metadata } from "next";

import { AnamnesisForm } from "@/components/forms/anamnesis-form";
import { PacienteSearchInput } from "@/components/pacientes/paciente-search-input";
import { PacienteSearchResults } from "@/components/pacientes/paciente-search-results";

import { createAnamnesis } from "./actions";
import {
  getHistoriasByPacienteId,
  getPacienteById,
  searchPacientes,
} from "./queries";

export const metadata: Metadata = {
  title: "Nueva historia",
};

type CreateHistoriaPageProps = {
  searchParams: Promise<{
    pacienteId?: string | string[];
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CreateHistoriaPage({
  searchParams,
}: CreateHistoriaPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const pacienteId = getParam(params.pacienteId).trim();
  const [pacientes, selectedPaciente] = await Promise.all([
    searchPacientes(query),
    getPacienteById(pacienteId),
  ]);
  const selectedPacienteHistorias = selectedPaciente
    ? await getHistoriasByPacienteId(selectedPaciente.id)
    : [];
  const visiblePacientes = selectedPaciente ? [selectedPaciente] : pacientes;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-normal">
            Nueva historia
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Primero selecciona el paciente. La historia quedara vinculada a su
            registro de identidad.
          </p>
        </div>

        <PacienteSearchInput initialValue={query} key={query} />
      </section>

      <PacienteSearchResults
        hideCreateHistoriaAction={Boolean(selectedPaciente)}
        pacientes={visiblePacientes}
        historiasByPacienteId={
          selectedPaciente
            ? { [selectedPaciente.id]: selectedPacienteHistorias }
            : undefined
        }
        query={query}
        selectedPacienteId={selectedPaciente?.id}
        newPacienteRoute="/estudiante/anamnesis/create-paciente"
      />

      {selectedPaciente ? (
        <section className="flex flex-col gap-4">
          <AnamnesisForm
            action={createAnamnesis}
            defaultValue={{ pacienteId: selectedPaciente.id }}
            key={selectedPaciente.id}
            pacienteGenero={selectedPaciente.genero}
            pacienteFechaNacimiento={new Date(selectedPaciente.datosPersonales.fechaNacimiento).toISOString()}
            successRedirectHref="/estudiante/anamnesis/create-historia"
          />
        </section>
      ) : null}
    </div>
  );
}
