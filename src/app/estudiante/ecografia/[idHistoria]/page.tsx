import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  EcografiaForm,
  type EcografiaFormValue,
} from "@/components/forms/ecografia-form";
import { db } from "@/lib/db";
import { getFileUrl } from "@/lib/file-storage";
import type { Ecografia } from "@/lib/schema/ecografia";
import type { Historia } from "@/lib/schema/historia";

import { saveEcografia } from "./actions";

export const metadata: Metadata = {
  title: "Ecografia",
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
  historiaId: string,
  ecografia?: Ecografia,
): Partial<EcografiaFormValue> {
  if (!ecografia) {
    return { historiaId };
  }

  return {
    historiaId,
    higado: {
      dimensiones: numberToString(ecografia.higado.dimensiones),
      hepatomegalia: ecografia.higado.hepatomegalia,
      parenquima: ecografia.higado.parenquima,
      diagnostico: ecografia.higado.diagnostico,
    },
    vesiculaBiliar: {
      paredes: ecografia.vesiculaBiliar.paredes,
      contenidoAnecoico: ecografia.vesiculaBiliar.contenidoAnecoico,
      barroBiliar: ecografia.vesiculaBiliar.barroBiliar,
      calculos: ecografia.vesiculaBiliar.calculos,
      diagnostico: ecografia.vesiculaBiliar.diagnostico,
    },
    riniones: {
      derecho: {
        longitud: numberToString(ecografia.riniones.derecho.longitud),
        parenquima: numberToString(ecografia.riniones.derecho.parenquima),
      },
      izquierdo: {
        longitud: numberToString(ecografia.riniones.izquierdo.longitud),
        parenquima: numberToString(ecografia.riniones.izquierdo.parenquima),
      },
      ecogenicidad: ecografia.riniones.ecogenicidad,
      relacionCorticoMedular: ecografia.riniones.relacionCorticoMedular,
      diagnostico: ecografia.riniones.diagnostico,
    },
  };
}

async function getImagePreview(ecografia?: Ecografia) {
  if (!ecografia?.imagen) {
    return undefined;
  }

  if (ecografia.imagen.data) {
    return `data:${ecografia.imagen.tipo};base64,${ecografia.imagen.data}`;
  }

  try {
    return await getFileUrl(ecografia.imagen.key);
  } catch {
    return ecografia.imagen.url;
  }
}

async function getHistoria(idHistoria: string) {
  try {
    const doc = await db.get(idHistoria);

    return isHistoria(doc) ? doc : null;
  } catch {
    return null;
  }
}

export default async function EcografiaPage({
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

  const action = saveEcografia.bind(null, decodedIdHistoria);
  const imagenPreview = await getImagePreview(historia.ecografia);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Ecografia</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra hallazgos ecograficos y adjunta una fotografia del estudio.
        </p>
      </div>

      <EcografiaForm
        action={action}
        defaultValue={getDefaultValue(decodedIdHistoria, historia.ecografia)}
        imagenPreview={imagenPreview}
        successRedirectHref="/estudiante/ecografia"
      />
    </div>
  );
}
