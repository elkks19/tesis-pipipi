import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  ExamenFisicoGeneralForm,
  type ExamenFisicoGeneralFormValue,
} from "@/components/forms/examen-fisico-general-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import type { ExamenFisicoGeneral } from "@/lib/schema/examenFisicoGeneral";
import { saveExamenFisicoGeneral } from "@/app/estudiante/examen-fisico-general/[idHistoria]/actions";
import { getHistoria, numberToString } from "../../_lib/historia-page";

export const metadata: Metadata = {
  title: "Docente | Examen fisico general",
};

function getDefaultValue(
  examen?: ExamenFisicoGeneral,
): Partial<ExamenFisicoGeneralFormValue> | undefined {
  if (!examen) {
    return undefined;
  }

  return {
    diagnosticoIMC: examen.diagnosticoIMC as ExamenFisicoGeneralFormValue["diagnosticoIMC"],
    frecuenciaCardiaca: numberToString(examen.frecuenciaCardiaca),
    frecuenciaRespiratoria: numberToString(examen.frecuenciaRespiratoria),
    imc: numberToString(examen.imc),
    indiceCinturaCadera: numberToString(examen.indiceCinturaCadera),
    perimetroCadera: numberToString(examen.perimetroCadera),
    perimetroCintura: numberToString(examen.perimetroCintura),
    peso: numberToString(examen.peso),
    presionArterial: {
      derecha: {
        max: numberToString(examen.presionArterial.derecha.max),
        min: numberToString(examen.presionArterial.derecha.min),
      },
      izquierda: {
        max: numberToString(examen.presionArterial.izquierda.max),
        min: numberToString(examen.presionArterial.izquierda.min),
      },
    },
    presionArterialMedia: numberToString(examen.presionArterialMedia),
    pulsos: numberToString(examen.pulsos),
    talla: numberToString(examen.talla),
    temperaturaAxilar: numberToString(examen.temperaturaAxilar),
  };
}

export default async function DocenteExamenFisicoGeneralCreatePage({
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

  const action = saveExamenFisicoGeneral.bind(null, decodedIdHistoria);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Examen fisico general
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra signos vitales, presion arterial y medidas antropometricas
          de la historia seleccionada.
        </p>
      </div>

      <HistoriaClinicalSummaryModal
        historia={historia}
        scope="examenFisicoGeneral"
      />

      <ExamenFisicoGeneralForm
        action={action}
        defaultValue={getDefaultValue(historia.examenFisicoGeneral)}
        successRedirectHref="/docente/examen-fisico-general"
      />
    </div>
  );
}
