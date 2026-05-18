import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  DiagnosticoForm,
  type DiagnosticoFormValue,
} from "@/components/forms/diagnostico-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import type { Diagnostico } from "@/lib/schema/diagnostico";
import { saveDiagnostico } from "@/app/estudiante/diagnostico/[idHistoria]/actions";
import { getHistoria } from "../../_lib/historia-page";

export const metadata: Metadata = {
  title: "Docente | Diagnostico",
};

function getDefaultValue(
  historiaId: string,
  diagnostico?: Diagnostico,
): Partial<DiagnosticoFormValue> {
  if (!diagnostico) {
    return { historiaId };
  }

  return {
    historiaId,
    planTrabajo: diagnostico.planTrabajo,
    principal: diagnostico.principal,
    recetaId: diagnostico.recetaId ?? "",
    secundarios: diagnostico.secundarios,
  };
}

export default async function DocenteDiagnosticoCreatePage({
  params,
}: {
  params: Promise<{ idHistoria: string }>;
}) {
  const { idHistoria } = await params;
  const decodedIdHistoria = decodeURIComponent(idHistoria);
  const historia = await getHistoria(decodedIdHistoria);

  if (!historia) {
    notFound();
  }

  const action = saveDiagnostico.bind(null, decodedIdHistoria);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Diagnostico</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Codifica el diagnostico final con CIE-11 y registra el plan de
          trabajo para cerrar la historia.
        </p>
      </div>

      <HistoriaClinicalSummaryModal historia={historia} scope="diagnostico" />

      <DiagnosticoForm
        action={action}
        defaultValue={getDefaultValue(decodedIdHistoria, historia.diagnostico)}
        successRedirectHref="/docente/diagnostico"
      />
    </div>
  );
}
