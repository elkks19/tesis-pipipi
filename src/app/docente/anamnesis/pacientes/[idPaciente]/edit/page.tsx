import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { updatePaciente } from "@/app/estudiante/anamnesis/create-paciente/actions";
import { getPacienteById } from "@/app/estudiante/anamnesis/create-historia/queries";
import {
  PacienteForm,
  type PacienteFormDefaultValue,
} from "@/components/forms/paciente-form";
import { getAuthenticatedUserId } from "@/lib/auth-session";

export const metadata: Metadata = {
  title: "Docente | Editar paciente",
};

type PageProps = {
  params: Promise<{
    idPaciente: string;
  }>;
};

export default async function DocenteEditPacientePage({ params }: PageProps) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const { idPaciente } = await params;
  const decodedIdPaciente = decodeURIComponent(idPaciente);
  const paciente = await getPacienteById(decodedIdPaciente);

  if (!paciente) {
    notFound();
  }

  return (
    <PacienteForm
      action={updatePaciente.bind(null, decodedIdPaciente)}
      defaultValue={paciente as PacienteFormDefaultValue}
      successRedirectHref={`/docente/anamnesis/create-historia?pacienteId=${encodeURIComponent(decodedIdPaciente)}`}
    />
  );
}
