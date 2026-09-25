import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  ExamenFisicoSegmentarioForm,
  type ExamenFisicoSegmentarioFormValue,
} from "@/components/forms/examen-fisico-segmentario-form";
import { db } from "@/lib/db";
import { PatientStationBanner } from "@/components/pacientes/patient-station-banner";
import type { ExamenFisicoSegmentario } from "@/lib/schema/examenFisicoSegmentario";
import type { Historia } from "@/lib/schema/historia";

import { saveExamenFisicoSegmentario } from "./actions";
import { ExamenSegmentarioQuickActions } from "../examen-segmentario-quick-actions";

export const metadata: Metadata = {
  title: "Examen fisico segmentario",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistoriaDocument = Historia & {
  _id?: string;
};

function isHistoria(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia"
  );
}

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

async function getHistoria(idHistoria: string) {
  try {
    const doc = await db.get(idHistoria);

    return isHistoria(doc) ? doc : null;
  } catch {
    return null;
  }
}

export default async function ExamenFisicoSegmentarioPage({
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <div className="flex flex-col gap-2 border-b pb-6">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estación clínica · 02</span>
        <h1 className="font-heading text-2xl font-semibold">
          Examen físico segmentario
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra los hallazgos por regiones, aparatos y sistemas de la
          historia seleccionada.
        </p>
      </div>

      <PatientStationBanner pacienteId={historia.pacienteId} />

      <ExamenSegmentarioQuickActions
        hasClinicalDetail={Boolean(
          historia.anamnesis || historia.examenFisicoGeneral || historia.examenFisicoSegmentario ||
          historia.laboratorios || historia.electrocardiograma || historia.espirometria ||
          historia.ecografia || historia.diagnostico,
        )}
        historiaId={decodedIdHistoria}
        showPdf
      />

      <ExamenFisicoSegmentarioForm
        action={action}
        defaultValue={getDefaultValue(historia.examenFisicoSegmentario)}
        successRedirectHref="/estudiante/examen-fisico-segmentario"
      />
    </div>
  );
}
