import type { Metadata } from "next";

import { AnamnesisForm } from "@/components/forms/anamnesis-form";
import { PacienteSearchInput } from "@/components/pacientes/paciente-search-input";
import { PacienteSearchResults } from "@/components/pacientes/paciente-search-results";
import { createAnamnesis } from "@/app/estudiante/anamnesis/create-historia/actions";
import {
  getPacienteById,
  searchPacientes,
} from "@/app/estudiante/anamnesis/create-historia/queries";

export const metadata: Metadata = {
  title: "Docente | Nueva historia",
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

export default async function DocenteCreateHistoriaPage({
  searchParams,
}: CreateHistoriaPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const pacienteId = getParam(params.pacienteId).trim();
  const [pacientes, selectedPaciente] = await Promise.all([
    searchPacientes(query),
    getPacienteById(pacienteId),
  ]);

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

        <PacienteSearchInput initialValue={query} />
      </section>

      <PacienteSearchResults
        newPacienteRoute="/docente/anamnesis/create-paciente"
        pacientes={pacientes}
        query={query}
        selectedPacienteId={selectedPaciente?.id}
      />

      {selectedPaciente ? (
        <section className="flex flex-col gap-4">
          <AnamnesisForm
            action={createAnamnesis}
            defaultValue={{ pacienteId: selectedPaciente.id }}
            key={selectedPaciente.id}
            successRedirectHref="/docente/anamnesis/create-historia"
          />
        </section>
      ) : null}
    </div>
  );
}
