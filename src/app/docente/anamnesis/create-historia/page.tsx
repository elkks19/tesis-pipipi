import type { Metadata } from "next";
import { ClipboardListIcon } from "lucide-react";
import { getPatientRegistrationAuthors } from "@/lib/pacientes/registration-queries";
import { PacienteListNavigation } from "@/components/pacientes/paciente-list-navigation";

import { AnamnesisForm } from "@/components/forms/anamnesis-form";
import { PacienteSearchInput } from "@/components/pacientes/paciente-search-input";
import { PacienteSearchResults } from "@/components/pacientes/paciente-search-results";
import { createAnamnesis } from "@/app/estudiante/anamnesis/create-historia/actions";
import {
  getHistoriasByPacienteId,
  getHistoriasByPacienteIds,
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
    page?: string | string[];
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
    searchPacientes(query, Number(getParam(params.page))),
    getPacienteById(pacienteId),
  ]);
  const selectedPacienteHistorias = selectedPaciente
    ? await getHistoriasByPacienteId(selectedPaciente.id)
    : [];
  const visiblePacientes = selectedPaciente ? [selectedPaciente] : pacientes.pacientes;
  const registrationAuthors = await getPatientRegistrationAuthors(visiblePacientes.map((paciente) => paciente.id));
  const pacientesWithAuthors = visiblePacientes.map((paciente) => ({
    ...paciente, registeredBy: registrationAuthors.get(paciente.id),
  }));
  const historiasByPacienteId = selectedPaciente
    ? { [selectedPaciente.id]: selectedPacienteHistorias }
    : await getHistoriasByPacienteIds(visiblePacientes.map((paciente) => paciente.id));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><ClipboardListIcon className="size-5" aria-hidden="true" /></div>
          <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Anamnesis · Atención clínica</p>
          <h1 className="font-heading text-2xl font-semibold tracking-normal">
            Nueva historia
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {selectedPaciente
              ? "Completa la anamnesis paso a paso. Puedes volver a cualquier sección antes de guardar."
              : "Selecciona un paciente para iniciar su historia clínica."}
          </p>
          </div>
        </div>

        {!selectedPaciente ? <PacienteSearchInput initialValue={query} key={query} /> : null}
      </section>

      <PacienteListNavigation
        basePath="/docente/anamnesis"
        query={query}
        pagination={pacientes}
        selected={Boolean(selectedPaciente)}
      />

      <section aria-label={selectedPaciente ? "Paciente seleccionado" : "Resultados de pacientes"} className={selectedPaciente ? "rounded-xl border bg-muted/20 p-3 sm:p-4" : undefined}>
      {selectedPaciente ? <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paciente seleccionado</p> : null}
      <PacienteSearchResults
        hideCreateHistoriaAction={Boolean(selectedPaciente)}
        createHistoriaRoute="/docente/anamnesis/create-historia"
        editPacienteRoute="/docente/anamnesis/pacientes"
        newPacienteRoute="/docente/anamnesis/create-paciente"
        pacientes={pacientesWithAuthors}
        showRegistrationAuthor
        historiasByPacienteId={historiasByPacienteId}
        query={query}
        selectedPacienteId={selectedPaciente?.id}
        page={pacientes.page}
      />
      </section>

      {!selectedPaciente && (pacientes.pacientes.length > 0 || pacientes.page > 1) ? (
        <PacienteListNavigation basePath="/docente/anamnesis" query={query} pagination={pacientes} footer />
      ) : null}

      {selectedPaciente ? (
        <section className="flex flex-col gap-4">
          <AnamnesisForm
            action={createAnamnesis}
            defaultValue={{ pacienteId: selectedPaciente.id }}
            key={selectedPaciente.id}
            pacienteGenero={selectedPaciente.genero}
            pacienteFechaNacimiento={new Date(selectedPaciente.datosPersonales.fechaNacimiento).toISOString()}
            successRedirectHref="/docente/anamnesis/create-historia"
          />
        </section>
      ) : null}
    </div>
  );
}
