import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  DiagnosticoForm,
  type DiagnosticoFormValue,
} from "@/components/forms/diagnostico-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getRecetaById, listViajeInventario } from "@/lib/farmacia";
import type { Diagnostico } from "@/lib/schema/diagnostico";
import type { Receta } from "@/lib/schema/farmacia";
import { saveDiagnostico } from "@/app/estudiante/diagnostico/[idHistoria]/actions";
import { getHistoria } from "../../_lib/historia-page";

export const metadata: Metadata = {
  title: "Docente | Diagnostico",
};

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

export default async function DocenteDiagnosticoCreatePage({
  params,
}: {
  params: Promise<{ idHistoria: string }>;
}) {
  const { idHistoria } = await params;
  const decodedIdHistoria = decodeURIComponent(idHistoria);
  const userId = await getAuthenticatedUserId();
  const historia = await getHistoria(decodedIdHistoria, {
    stationKey: "diagnostico",
    userId: userId ?? undefined,
  });

  if (!historia) {
    notFound();
  }

  const action = saveDiagnostico.bind(null, decodedIdHistoria);
  const [inventarioItems, receta] = await Promise.all([
    historia.viajeId ? listViajeInventario(historia.viajeId) : Promise.resolve([]),
    getRecetaById(historia.diagnostico?.recetaId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Diagnostico</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Codifica el diagnostico final con CIE-11 y registra el plan de
          trabajo para cerrar la historia.
        </p>
      </div>

      <HistoriaClinicalSummaryModal historia={historia} scope="diagnostico" />

      <DiagnosticoForm
        action={action}
        defaultValue={getDefaultValue(decodedIdHistoria, historia.diagnostico, receta)}
        inventarioItems={inventarioItems}
        successRedirectHref="/docente/diagnostico"
      />
    </div>
  );
}
