import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  ElectrocardiogramaForm,
  type ElectrocardiogramaFormValue,
} from "@/components/forms/electrocardiograma-form";
import { db } from "@/lib/db";
import type { Electrocardiograma } from "@/lib/schema/electrocardiograma";
import type { Historia } from "@/lib/schema/historia";

import { saveElectrocardiograma } from "./actions";

export const metadata: Metadata = {
  title: "Electrocardiograma",
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
  electrocardiograma?: Electrocardiograma,
): Partial<ElectrocardiogramaFormValue> {
  if (!electrocardiograma) {
    return {};
  }

  return {
    ritmo: electrocardiograma.ritmo,
    frecuenciaCardiaca: numberToString(
      electrocardiograma.frecuenciaCardiaca,
    ),
    crecimientoAuriculaDerecha:
      electrocardiograma.crecimientoAuriculaDerecha,
    crecimientoAuriculaIzquierda:
      electrocardiograma.crecimientoAuriculaIzquierda,
    crecimientoVentriculoDerecho:
      electrocardiograma.crecimientoVentriculoDerecho,
    crecimientoVentriculoIzquierdo:
      electrocardiograma.crecimientoVentriculoIzquierdo,
    intervaloPR: numberToString(electrocardiograma.intervaloPR),
    intervaloQTc: numberToString(electrocardiograma.intervaloQTc),
    supraInfraDesnivelST: electrocardiograma.supraInfraDesnivelST,
    derivacionSupraInfraDesnivelST:
      electrocardiograma.derivacionSupraInfraDesnivelST,
    duracionOndaP: numberToString(electrocardiograma.duracionOndaP),
    duracionComplejoQRS: numberToString(
      electrocardiograma.duracionComplejoQRS,
    ),
    duracionOndaT: numberToString(electrocardiograma.duracionOndaT),
    extrasistoleSupraventricular:
      electrocardiograma.extrasistoleSupraventricular,
    extrasistoleIntraventricular:
      electrocardiograma.extrasistoleIntraventricular,
    diagnostico: electrocardiograma.diagnostico,
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

export default async function ElectrocardiogramaCreatePage({
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

  const action = saveElectrocardiograma.bind(null, decodedIdHistoria);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Electrocardiograma
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra ritmo, intervalos, ondas y diagnostico de la lectura
          cardiaca.
        </p>
      </div>

      <ElectrocardiogramaForm
        action={action}
        defaultValue={getDefaultValue(historia.electrocardiograma)}
        successRedirectHref="/estudiante/electrocardiograma"
      />
    </div>
  );
}
