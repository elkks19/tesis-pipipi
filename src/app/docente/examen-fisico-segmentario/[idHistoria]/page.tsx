import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  ExamenFisicoSegmentarioForm,
  type ExamenFisicoSegmentarioFormValue,
} from "@/components/forms/examen-fisico-segmentario-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import type { ExamenFisicoSegmentario } from "@/lib/schema/examenFisicoSegmentario";
import { saveExamenFisicoSegmentario } from "@/app/estudiante/examen-fisico-segmentario/[idHistoria]/actions";
import { getHistoria } from "../../_lib/historia-page";

export const metadata: Metadata = {
  title: "Docente | Examen fisico segmentario",
};

function getDefaultValue(
  examen?: ExamenFisicoSegmentario,
): Partial<ExamenFisicoSegmentarioFormValue> | undefined {
  if (!examen) {
    return undefined;
  }

  return {
    abdomenPelvis: examen.abdomenPelvis,
    aparatoCardiovascular: examen.aparatoCardiovascular,
    aparatoGenitourinario: examen.aparatoGenitourinario,
    aparatoOsteoartromuscular: examen.aparatoOsteoartromuscular,
    aparatoRespiratorio: examen.aparatoRespiratorio,
    cabeza: examen.cabeza,
    cuello: examen.cuello,
    pielFaneras: examen.pielFaneras,
    sistemaHemolinfopoyetico: examen.sistemaHemolinfopoyetico,
    sistemaNerviosoCentral: examen.sistemaNerviosoCentral,
  };
}

export default async function DocenteExamenFisicoSegmentarioCreatePage({
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

  const action = saveExamenFisicoSegmentario.bind(null, decodedIdHistoria);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Examen fisico segmentario
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra los hallazgos por regiones, aparatos y sistemas de la
          historia seleccionada.
        </p>
      </div>

      <HistoriaClinicalSummaryModal
        historia={historia}
        scope="examenFisicoSegmentario"
      />

      <ExamenFisicoSegmentarioForm
        action={action}
        defaultValue={getDefaultValue(historia.examenFisicoSegmentario)}
        successRedirectHref="/docente/examen-fisico-segmentario"
      />
    </div>
  );
}
