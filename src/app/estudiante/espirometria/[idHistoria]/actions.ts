"use server";

import { revalidatePath } from "next/cache";

import { logStationActivity } from "@/lib/activity-log";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import {
  CreateEspirometriaSchema,
  type Espirometria,
} from "@/lib/schema/espirometria";
import type { Historia } from "@/lib/schema/historia";
import { canAccessActiveStationHistoria } from "@/lib/station-histories";

export type SaveEspirometriaActionState = {
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
  const fuenteDatosTeoricos = getString(formData, "fuenteDatosTeoricos");

  return {
    FEV1: requiredNumber(formData, "FEV1"),
    porcentajeFEVteorico: requiredNumber(formData, "porcentajeFEVteorico"),
    FVC: requiredNumber(formData, "FVC"),
    porcentajeFVCteorico: requiredNumber(formData, "porcentajeFVCteorico"),
    FEV1FVC: requiredNumber(formData, "FEV1FVC"),
    porcentajeFEV1FVCteorico: requiredNumber(
      formData,
      "porcentajeFEV1FVCteorico",
    ),
    flujoEspiratorioPicoPEF: requiredNumber(
      formData,
      "flujoEspiratorioPicoPEF",
    ),
    porcentajePEFteorico: requiredNumber(formData, "porcentajePEFteorico"),
    ...(fuenteDatosTeoricos ? { fuenteDatosTeoricos } : {}),
    observaciones: formData
      .getAll("observaciones")
      .filter((value): value is string => typeof value === "string"),
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

export async function saveEspirometria(
  idHistoria: string,
  _previousState: SaveEspirometriaActionState,
  formData: FormData,
): Promise<SaveEspirometriaActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para guardar la espirometria.",
      ok: false,
    };
  }

  const parsed = CreateEspirometriaSchema.safeParse(getPayload(formData));

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
      stationKey: "espirometria",
      userId,
    });

    if (!canEdit) {
      return {
        message: "No puedes editar una historia fuera de tu viaje activo.",
        ok: false,
      };
    }

    const isRequested = Boolean(
      historia.examenesComplementariosSolicitados?.espirometria,
    );

    if (!isRequested && !historia.espirometria) {
      return {
        message: "Esta historia no tiene espirometria solicitada.",
        ok: false,
      };
    }

    const espirometria = {
      ...(parsed.data as Espirometria),
      created_by: historia.espirometria?.created_by ?? userId,
      updated_by: userId,
    };
    const nextHistoria = {
      ...historia,
      espirometria,
    };

    await db.put(nextHistoria);
    await logStationActivity({
      actorId: userId,
      after: espirometria,
      before: historia.espirometria,
      historia,
      stationKey: "espirometria",
    }).catch(() => undefined);

    revalidatePath(`/estudiante/espirometria/${idHistoria}`);
    revalidatePath("/estudiante/espirometria");

    return {
      message: "Espirometria guardada correctamente.",
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
          : "No se pudo guardar la espirometria.",
      ok: false,
    };
  }
}
