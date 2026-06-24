import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  EcografiaForm,
  type EcografiaFormValue,
} from "@/components/forms/ecografia-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFileUrl } from "@/lib/file-storage";
import type { Ecografia } from "@/lib/schema/ecografia";
import { saveEcografia } from "@/app/estudiante/ecografia/[idHistoria]/actions";
import { getHistoria, numberToString } from "../../_lib/historia-page";

export const metadata: Metadata = {
  title: "Docente | Ecografia",
};

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
    riñones: {
      derecho: {
        longitud: numberToString(ecografia.riñones.derecho.longitud),
        parenquima: numberToString(ecografia.riñones.derecho.parenquima),
      },
      izquierdo: {
        longitud: numberToString(ecografia.riñones.izquierdo.longitud),
        parenquima: numberToString(ecografia.riñones.izquierdo.parenquima),
      },
      ecogenicidad: ecografia.riñones.ecogenicidad,
      relacionCorticoMedular: ecografia.riñones.relacionCorticoMedular,
      diagnostico: ecografia.riñones.diagnostico,
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

export default async function DocenteEcografiaCreatePage({
  params,
}: {
  params: Promise<{ idHistoria: string }>;
}) {
  const { idHistoria } = await params;
  const decodedIdHistoria = decodeURIComponent(idHistoria);
  const userId = await getAuthenticatedUserId();
  const historia = await getHistoria(decodedIdHistoria, {
    stationKey: "ecografia",
    userId: userId ?? undefined,
  });

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

      <HistoriaClinicalSummaryModal historia={historia} scope="complementarios" />

      <EcografiaForm
        action={action}
        defaultValue={getDefaultValue(decodedIdHistoria, historia.ecografia)}
        imagenPreview={imagenPreview}
        successRedirectHref="/docente/ecografia"
      />
    </div>
  );
}
