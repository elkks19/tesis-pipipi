import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  LaboratoriosForm,
  type LaboratoriosFormValue,
} from "@/components/forms/laboratorios-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import { PatientStationBanner } from "@/components/pacientes/patient-station-banner";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import type { Laboratorios } from "@/lib/schema/laboratorios";
import { saveLaboratorios } from "@/app/estudiante/laboratorios/[idHistoria]/actions";
import { getHistoria } from "../../_lib/historia-page";

export const metadata: Metadata = {
  title: "Docente | Laboratorios",
};

function getDefaultValue(
  laboratorios?: Laboratorios,
): Partial<LaboratoriosFormValue> {
  if (!laboratorios) {
    return {};
  }

  return {
    glicemiaCapilar: laboratorios.glicemiaCapilar,
    grupoSanguineo: laboratorios.grupoSanguineo,
    otrosEstudios: laboratorios.otrosEstudios ?? [],
  };
}

export default async function DocenteLaboratoriosCreatePage({
  params,
}: {
  params: Promise<{ idHistoria: string }>;
}) {
  const { idHistoria } = await params;
  const decodedIdHistoria = decodeURIComponent(idHistoria);
  const userId = await getAuthenticatedUserId();
  const historia = await getHistoria(decodedIdHistoria, {
    stationKey: "laboratorios",
    userId: userId ?? undefined,
  });

  if (!historia) {
    notFound();
  }

  const action = saveLaboratorios.bind(null, decodedIdHistoria);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Laboratorios</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra resultados basales y estudios adicionales solicitados.
        </p>
      </div>

      <PatientStationBanner pacienteId={historia.pacienteId} />

      <HistoriaClinicalSummaryModal historia={historia} scope="complementarios" />

      <LaboratoriosForm
        action={action}
        defaultValue={getDefaultValue(historia.laboratorios)}
        successRedirectHref="/docente/laboratorios"
      />
    </div>
  );
}
