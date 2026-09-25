import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  DiagnosticoForm,
  type DiagnosticoFormValue,
} from "@/components/forms/diagnostico-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import { db } from "@/lib/db";
import { PatientStationBanner } from "@/components/pacientes/patient-station-banner";
import { getRecetaById, listViajeInventario } from "@/lib/farmacia";
import type { Diagnostico } from "@/lib/schema/diagnostico";
import type { Receta } from "@/lib/schema/farmacia";
import type { Historia } from "@/lib/schema/historia";

import { saveDiagnostico } from "./actions";

export const metadata: Metadata = {
  title: "Diagnóstico",
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
  receta?: Receta | null,
): Partial<DiagnosticoFormValue> {
  const recetaValue = receta
    ? {
        indicacionesGenerales: receta.indicacionesGenerales ?? "",
        medicamentos: receta.medicamentos.map((medicamento) => ({
          cantidad:
            typeof medicamento.cantidad === "number" ? String(medicamento.cantidad) : "",
          catalogoId: medicamento.catalogoId ?? "",
          concentracion: medicamento.concentracion ?? "",
          dosis: medicamento.dosis ?? "",
          duracion: medicamento.duracion ?? "",
          formaFarmaceutica: medicamento.formaFarmaceutica ?? "",
          frecuencia: medicamento.frecuencia ?? "",
          indicaciones: medicamento.indicaciones ?? "",
          inventarioItemId: medicamento.inventarioItemId ?? "",
          nombre: medicamento.nombre ?? "",
          principioActivo: medicamento.principioActivo ?? "",
          unidad: medicamento.unidad ?? "",
          viaAdministracion: medicamento.viaAdministracion ?? "",
        })),
      }
    : undefined;

  if (!diagnostico) {
    return { historiaId, receta: recetaValue };
  }

  return {
    historiaId,
    planTrabajo: diagnostico.planTrabajo,
    principal: diagnostico.principal,
    recetaId: diagnostico.recetaId ?? "",
    receta: recetaValue,
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
  const [inventarioItems, receta] = await Promise.all([
    historia.viajeId ? listViajeInventario(historia.viajeId) : Promise.resolve([]),
    getRecetaById(historia.diagnostico?.recetaId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 rounded-xl border bg-background px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
      <div className="flex flex-col gap-1 border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estación clínica · Cierre de historia</p>
        <h1 className="font-heading text-2xl font-semibold">Diagnóstico</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Codifica el diagnóstico final con CIE-11, define el plan y registra la receta.
        </p>
      </div>

      <PatientStationBanner pacienteId={historia.pacienteId} />

      <HistoriaClinicalSummaryModal historia={historia} scope="diagnostico" />

      <DiagnosticoForm
        action={action}
        defaultValue={getDefaultValue(decodedIdHistoria, historia.diagnostico, receta)}
        inventarioItems={inventarioItems}
        successRedirectHref="/estudiante/diagnostico"
      />
    </div>
  );
}
