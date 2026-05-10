import type { Metadata } from "next";
import { PacienteForm } from "@/components/forms/paciente-form";

import { createPaciente } from "./actions";

export const metadata: Metadata = {
  title: "Nuevo paciente",
};

export default function CreatePacientePage() {
  return (
    <PacienteForm
      action={createPaciente}
      successRedirectHref="/estudiante/anamnesis/create-historia"
    />
  );
}
