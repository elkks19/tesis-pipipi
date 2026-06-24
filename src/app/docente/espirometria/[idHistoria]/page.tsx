import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  EspirometriaForm,
  type EspirometriaFormValue,
} from "@/components/forms/espirometria-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import type { Espirometria } from "@/lib/schema/espirometria";
import { saveEspirometria } from "@/app/estudiante/espirometria/[idHistoria]/actions";
import { getHistoria, numberToString } from "../../_lib/historia-page";

export const metadata: Metadata = {
  title: "Docente | Espirometria",
};

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

export default async function DocenteEspirometriaCreatePage({
  params,
}: {
  params: Promise<{ idHistoria: string }>;
}) {
  const { idHistoria } = await params;
  const decodedIdHistoria = decodeURIComponent(idHistoria);
  const userId = await getAuthenticatedUserId();
  const historia = await getHistoria(decodedIdHistoria, {
    stationKey: "espirometria",
    userId: userId ?? undefined,
  });

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

      <HistoriaClinicalSummaryModal historia={historia} scope="complementarios" />

      <EspirometriaForm
        action={action}
        defaultValue={getDefaultValue(historia.espirometria)}
        successRedirectHref="/docente/espirometria"
      />
    </div>
  );
}
