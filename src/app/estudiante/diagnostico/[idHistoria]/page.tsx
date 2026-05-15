import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  DiagnosticoForm,
  type DiagnosticoFormValue,
} from "@/components/forms/diagnostico-form";
import { HistoriaClinicalSummary } from "@/components/historias/historia-clinical-summary";
import { db } from "@/lib/db";
import type { Diagnostico } from "@/lib/schema/diagnostico";
import type { Historia } from "@/lib/schema/historia";

import { saveDiagnostico } from "./actions";

export const metadata: Metadata = {
  title: "Diagnostico",
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

async function getHistoria(idHistoria: string) {
  try {
    const doc = await db.get(idHistoria);

    return isHistoria(doc) ? doc : null;
  } catch {
    return null;
  }
}

export default async function DiagnosticoCreatePage({
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

      <HistoriaClinicalSummary historia={historia} scope="diagnostico" />

      <DiagnosticoForm
        action={action}
        defaultValue={getDefaultValue(decodedIdHistoria, historia.diagnostico)}
        successRedirectHref="/estudiante/diagnostico"
      />
    </div>
  );
}
