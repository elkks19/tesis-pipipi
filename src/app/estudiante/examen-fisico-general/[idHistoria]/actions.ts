"use server";

import { revalidatePath } from "next/cache";

import { logStationActivity } from "@/lib/activity-log";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import {
  CreateExamenFisicoGeneralSchema,
  type ExamenFisicoGeneral,
} from "@/lib/schema/examenFisicoGeneral";
import type { Historia } from "@/lib/schema/historia";
import { canAccessActiveStationHistoria } from "@/lib/station-histories";

export type SaveExamenFisicoGeneralActionState = {
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

  return typeof value === "string" ? value : "";
}

function requiredNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();

  return value.length > 0 ? Number(value) : Number.NaN;
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
    presionArterial: {
      derecha: {
        min: requiredNumber(formData, "presionArterial.derecha.min"),
        max: requiredNumber(formData, "presionArterial.derecha.max"),
      },
      izquierda: {
        min: requiredNumber(formData, "presionArterial.izquierda.min"),
        max: requiredNumber(formData, "presionArterial.izquierda.max"),
      },
    },
    presionArterialMedia: requiredNumber(formData, "presionArterialMedia"),
    pulsos: requiredNumber(formData, "pulsos"),
    frecuenciaRespiratoria: requiredNumber(formData, "frecuenciaRespiratoria"),
    frecuenciaCardiaca: requiredNumber(formData, "frecuenciaCardiaca"),
    temperaturaAxilar: requiredNumber(formData, "temperaturaAxilar"),
    peso: requiredNumber(formData, "peso"),
    talla: requiredNumber(formData, "talla"),
    imc: requiredNumber(formData, "imc"),
    perimetroCadera: requiredNumber(formData, "perimetroCadera"),
    perimetroCintura: requiredNumber(formData, "perimetroCintura"),
    indiceCinturaCadera: requiredNumber(formData, "indiceCinturaCadera"),
    diagnosticoIMC: getString(formData, "diagnosticoIMC"),
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

export async function saveExamenFisicoGeneral(
  idHistoria: string,
  _previousState: SaveExamenFisicoGeneralActionState,
  formData: FormData,
): Promise<SaveExamenFisicoGeneralActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para guardar el examen fisico general.",
      ok: false,
    };
  }

  const parsed = CreateExamenFisicoGeneralSchema.safeParse(
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

    const canEdit = await canAccessActiveStationHistoria({
      historia,
      stationKey: "examenFisicoGeneral",
      userId,
    });

    if (!canEdit) {
      return {
        message: "No puedes editar una historia fuera de tu viaje activo.",
        ok: false,
      };
    }

    const examenFisicoGeneral = {
      ...(parsed.data as ExamenFisicoGeneral),
      created_by: historia.examenFisicoGeneral?.created_by ?? userId,
      updated_by: userId,
    };
    const nextHistoria = {
      ...historia,
      examenFisicoGeneral,
    };

    await db.put(nextHistoria);
    await logStationActivity({
      actorId: userId,
      after: examenFisicoGeneral,
      before: historia.examenFisicoGeneral,
      historia,
      stationKey: "examenFisicoGeneral",
    }).catch(() => undefined);

    revalidatePath(`/estudiante/examen-fisico-general/${idHistoria}`);
    revalidatePath("/estudiante/examen-fisico-general");
    revalidatePath(`/docente/examen-fisico-general/${idHistoria}`);
    revalidatePath("/docente/examen-fisico-general");

    return {
      message: "Examen fisico general guardado correctamente.",
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
          : "No se pudo guardar el examen fisico general.",
      ok: false,
    };
  }
}
