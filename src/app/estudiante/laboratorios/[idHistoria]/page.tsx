import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  LaboratoriosForm,
  type LaboratoriosFormValue,
} from "@/components/forms/laboratorios-form";
import { db } from "@/lib/db";
import type { Historia } from "@/lib/schema/historia";
import type { Laboratorios } from "@/lib/schema/laboratorios";

import { saveLaboratorios } from "./actions";

export const metadata: Metadata = {
  title: "Laboratorios",
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

async function getHistoria(idHistoria: string) {
  try {
    const doc = await db.get(idHistoria);

    return isHistoria(doc) ? doc : null;
  } catch {
    return null;
  }
}

export default async function LaboratoriosCreatePage({
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

  const action = saveLaboratorios.bind(null, decodedIdHistoria);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Laboratorios</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registra resultados basales y estudios adicionales solicitados.
        </p>
      </div>

      <LaboratoriosForm
        action={action}
        defaultValue={getDefaultValue(historia.laboratorios)}
        successRedirectHref="/estudiante/laboratorios"
      />
    </div>
  );
}
