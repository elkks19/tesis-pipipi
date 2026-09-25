import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  ExamenFisicoGeneralForm,
  type ExamenFisicoGeneralFormValue,
} from "@/components/forms/examen-fisico-general-form";
import { db } from "@/lib/db";
import { PatientStationBanner } from "@/components/pacientes/patient-station-banner";
import type { ExamenFisicoGeneral } from "@/lib/schema/examenFisicoGeneral";
import type { Historia } from "@/lib/schema/historia";

import { saveExamenFisicoGeneral } from "./actions";
import { ExamenGeneralQuickActions } from "../examen-general-quick-actions";

export const metadata: Metadata = {
  title: "Examen fisico general",
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

function numberToString(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

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

async function getHistoria(idHistoria: string) {
  try {
    const doc = await db.get(idHistoria);

    return isHistoria(doc) ? doc : null;
  } catch {
    return null;
  }
}

export default async function ExamenFisicoGeneralPage({
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <div className="flex flex-col gap-2 border-b pb-6">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estación clínica · 01</span>
        <h1 className="font-heading text-2xl font-semibold">
          Examen físico general
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra signos vitales, presión arterial y medidas antropométricas
          de la historia seleccionada.
        </p>
      </div>

      <PatientStationBanner pacienteId={historia.pacienteId} />

      <ExamenGeneralQuickActions
        hasClinicalDetail={Boolean(
          historia.anamnesis || historia.examenFisicoGeneral || historia.examenFisicoSegmentario ||
          historia.laboratorios || historia.electrocardiograma || historia.espirometria ||
          historia.ecografia || historia.diagnostico,
        )}
        historiaId={decodedIdHistoria}
        showPdf
      />

      <ExamenFisicoGeneralForm
        action={action}
        defaultValue={getDefaultValue(historia.examenFisicoGeneral)}
        successRedirectHref="/estudiante/examen-fisico-general"
      />
    </div>
  );
}
