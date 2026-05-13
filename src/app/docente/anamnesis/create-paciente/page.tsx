import type { Metadata } from "next";

import { createPaciente } from "@/app/estudiante/anamnesis/create-paciente/actions";
import { PacienteForm } from "@/components/forms/paciente-form";

export const metadata: Metadata = {
  title: "Docente | Nuevo paciente",
};

export default function DocenteCreatePacientePage() {
  return (
    <PacienteForm
      action={createPaciente}
      successRedirectHref="/docente/anamnesis/create-historia"
    />
  );
}
