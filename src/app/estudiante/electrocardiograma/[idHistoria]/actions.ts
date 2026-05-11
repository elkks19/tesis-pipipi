"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import {
  CreateElectrocardiogramaSchema,
  type Electrocardiograma,
} from "@/lib/schema/electrocardiograma";
import type { Historia } from "@/lib/schema/historia";

export type SaveElectrocardiogramaActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type HistoriaDocument = Historia & {
  _id: string;
  _rev: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function requiredNumber(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value.length > 0 ? Number(value) : Number.NaN;
}

function requiredBoolean(formData: FormData, key: string) {
  return formData.get(key) === "true";
}

function getFieldErrors(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray(error.issues)
  ) {
    return error.issues.reduce<Record<string, string>>((acc, issue) => {
      if (
        typeof issue === "object" &&
        issue !== null &&
        "path" in issue &&
        "message" in issue &&
        Array.isArray(issue.path)
      ) {
        acc[issue.path.join(".")] = String(issue.message);
      }

      return acc;
    }, {});
  }

  return {};
}

function getPayload(formData: FormData) {
  return {
    ritmo: getString(formData, "ritmo"),
    frecuenciaCardiaca: requiredNumber(formData, "frecuenciaCardiaca"),
    crecimientoAuriculaDerecha: requiredBoolean(
      formData,
      "crecimientoAuriculaDerecha",
    ),
    crecimientoAuriculaIzquierda: requiredBoolean(
      formData,
      "crecimientoAuriculaIzquierda",
    ),
    crecimientoVentriculoDerecho: requiredBoolean(
      formData,
      "crecimientoVentriculoDerecho",
    ),
    crecimientoVentriculoIzquierdo: requiredBoolean(
      formData,
      "crecimientoVentriculoIzquierdo",
    ),
    intervaloPR: requiredNumber(formData, "intervaloPR"),
    intervaloQTc: requiredNumber(formData, "intervaloQTc"),
    supraInfraDesnivelST: requiredBoolean(formData, "supraInfraDesnivelST"),
    derivacionSupraInfraDesnivelST: getString(
      formData,
      "derivacionSupraInfraDesnivelST",
    ),
    duracionOndaP: requiredNumber(formData, "duracionOndaP"),
    duracionComplejoQRS: requiredNumber(formData, "duracionComplejoQRS"),
    duracionOndaT: requiredNumber(formData, "duracionOndaT"),
    extrasistoleSupraventricular: requiredBoolean(
      formData,
      "extrasistoleSupraventricular",
    ),
    extrasistoleIntraventricular: requiredBoolean(
      formData,
      "extrasistoleIntraventricular",
    ),
    diagnostico: getString(formData, "diagnostico"),
  };
}

function isHistoriaDocument(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia" &&
    "_id" in doc &&
    "_rev" in doc
  );
}

export async function saveElectrocardiograma(
  idHistoria: string,
  _previousState: SaveElectrocardiogramaActionState,
  formData: FormData,
): Promise<SaveElectrocardiogramaActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para guardar el electrocardiograma.",
      ok: false,
    };
  }

  const parsed = CreateElectrocardiogramaSchema.safeParse(
    getPayload(formData),
  );

  if (!parsed.success) {
    return {
      errors: getFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar.",
      ok: false,
    };
  }

  try {
    const historia = await db.get(idHistoria);

    if (!isHistoriaDocument(historia)) {
      return {
        message: "El documento seleccionado no corresponde a una historia.",
        ok: false,
      };
    }

    const isRequested = Boolean(
      historia.examenesComplementariosSolicitados?.electrocardiograma,
    );

    if (!isRequested && !historia.electrocardiograma) {
      return {
        message: "Esta historia no tiene electrocardiograma solicitado.",
        ok: false,
      };
    }

    await db.put({
      ...historia,
      electrocardiograma: {
        ...(parsed.data as Electrocardiograma),
        created_by: historia.electrocardiograma?.created_by ?? userId,
        updated_by: userId,
      },
    });

    revalidatePath(`/estudiante/electrocardiograma/${idHistoria}`);
    revalidatePath("/estudiante/electrocardiograma");

    return {
      message: "Electrocardiograma guardado correctamente.",
      ok: true,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404
    ) {
      return {
        message: "No existe una historia con este identificador.",
        ok: false,
      };
    }

    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el electrocardiograma.",
      ok: false,
    };
  }
}
