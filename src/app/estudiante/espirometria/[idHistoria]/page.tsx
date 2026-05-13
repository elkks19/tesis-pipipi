import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  EspirometriaForm,
  type EspirometriaFormValue,
} from "@/components/forms/espirometria-form";
import { db } from "@/lib/db";
import type { Espirometria } from "@/lib/schema/espirometria";
import type { Historia } from "@/lib/schema/historia";

import { saveEspirometria } from "./actions";

export const metadata: Metadata = {
  title: "Espirometria",
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
  espirometria?: Espirometria,
): Partial<EspirometriaFormValue> {
  if (!espirometria) {
    return {};
  }

  return {
    FEV1: numberToString(espirometria.FEV1),
    porcentajeFEVteorico: numberToString(espirometria.porcentajeFEVteorico),
    FVC: numberToString(espirometria.FVC),
    porcentajeFVCteorico: numberToString(espirometria.porcentajeFVCteorico),
    FEV1FVC: numberToString(espirometria.FEV1FVC),
    porcentajeFEV1FVCteorico: numberToString(
      espirometria.porcentajeFEV1FVCteorico,
    ),
    flujoEspiratorioPicoPEF: numberToString(
      espirometria.flujoEspiratorioPicoPEF,
    ),
    porcentajePEFteorico: numberToString(espirometria.porcentajePEFteorico),
    fuenteDatosTeoricos: espirometria.fuenteDatosTeoricos ?? "",
    observaciones: espirometria.observaciones,
    diagnostico: espirometria.diagnostico,
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

export default async function EspirometriaCreatePage({
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

  const action = saveEspirometria.bind(null, decodedIdHistoria);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Espirometria</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra volumenes, flujos, calidad de maniobra y diagnostico.
        </p>
      </div>

      <EspirometriaForm
        action={action}
        defaultValue={getDefaultValue(historia.espirometria)}
        successRedirectHref="/estudiante/espirometria"
      />
    </div>
  );
}
