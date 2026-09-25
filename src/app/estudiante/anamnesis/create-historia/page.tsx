import type { Metadata } from "next";
import { PacienteListNavigation } from "@/components/pacientes/paciente-list-navigation";

import { AnamnesisForm } from "@/components/forms/anamnesis-form";
import { PacienteSearchInput } from "@/components/pacientes/paciente-search-input";
import { PacienteSearchResults } from "@/components/pacientes/paciente-search-results";
import { PatientIdentityCard } from "@/components/pacientes/patient-station-banner";

import { createAnamnesis } from "./actions";
import {
  getHistoriasByPacienteId,
  getHistoriasByPacienteIds,
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
    page?: string | string[];
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
    searchPacientes(query, Number(getParam(params.page))),
    getPacienteById(pacienteId),
  ]);
  const selectedPacienteHistorias = selectedPaciente
    ? await getHistoriasByPacienteId(selectedPaciente.id)
    : [];
  const visiblePacientes = selectedPaciente ? [selectedPaciente] : pacientes.pacientes;
  const historiasByPacienteId = selectedPaciente
    ? { [selectedPaciente.id]: selectedPacienteHistorias }
    : await getHistoriasByPacienteIds(visiblePacientes.map((paciente) => paciente.id));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-normal">
            Nueva historia
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {selectedPaciente
              ? "Completa la anamnesis paso a paso. Puedes volver a cualquier sección antes de guardar."
              : "Selecciona un paciente para iniciar su historia clínica."}
          </p>
        </div>

        {!selectedPaciente ? <PacienteSearchInput initialValue={query} key={query} /> : null}
      </section>

      <PacienteListNavigation
        basePath="/estudiante/anamnesis"
        query={query}
        pagination={pacientes}
        selected={Boolean(selectedPaciente)}
      />

      <section aria-label={selectedPaciente ? "Paciente seleccionado" : "Resultados de pacientes"} className={selectedPaciente ? "rounded-xl border bg-muted/20 p-3 sm:p-4" : undefined}>
      {selectedPaciente ? <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paciente seleccionado</p> : null}
      <PacienteSearchResults
        hideCreateHistoriaAction={Boolean(selectedPaciente)}
        pacientes={visiblePacientes}
        historiasByPacienteId={historiasByPacienteId}
        query={query}
        selectedPacienteId={selectedPaciente?.id}
        page={pacientes.page}
        newPacienteRoute="/estudiante/anamnesis/create-paciente"
      />
      </section>

      {!selectedPaciente && (pacientes.pacientes.length > 0 || pacientes.page > 1) ? (
        <PacienteListNavigation basePath="/estudiante/anamnesis" query={query} pagination={pacientes} footer />
      ) : null}

      {selectedPaciente ? (
        <section className="flex flex-col gap-4">
          <PatientIdentityCard paciente={selectedPaciente} />
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
