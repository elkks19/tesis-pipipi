"use server";

import { revalidatePath } from "next/cache";

import { logStationActivity } from "@/lib/activity-log";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import {
  CreateExamenFisicoSegmentarioSchema,
  type ExamenFisicoSegmentario,
} from "@/lib/schema/examenFisicoSegmentario";
import type { Historia } from "@/lib/schema/historia";

export type SaveExamenFisicoSegmentarioActionState = {
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
    abdomenPelvis: getString(formData, "abdomenPelvis"),
    aparatoCardiovascular: getString(formData, "aparatoCardiovascular"),
    aparatoGenitourinario: getString(formData, "aparatoGenitourinario"),
    aparatoOsteoartromuscular: getString(
      formData,
      "aparatoOsteoartromuscular",
    ),
    aparatoRespiratorio: getString(formData, "aparatoRespiratorio"),
    cabeza: getString(formData, "cabeza"),
    cuello: getString(formData, "cuello"),
    pielFaneras: getString(formData, "pielFaneras"),
    sistemaHemolinfopoyetico: getString(
      formData,
      "sistemaHemolinfopoyetico",
    ),
    sistemaNerviosoCentral: getString(formData, "sistemaNerviosoCentral"),
  };
}

function getExamenesComplementariosSolicitados(formData: FormData) {
  return {
    ecografia:
      formData.get("examenesComplementariosSolicitados.ecografia") === "true",
    laboratorios:
      formData.get("examenesComplementariosSolicitados.laboratorios") ===
      "true",
    espirometria:
      formData.get("examenesComplementariosSolicitados.espirometria") ===
      "true",
    electrocardiograma:
      formData.get(
        "examenesComplementariosSolicitados.electrocardiograma",
      ) === "true",
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

export async function saveExamenFisicoSegmentario(
  idHistoria: string,
  _previousState: SaveExamenFisicoSegmentarioActionState,
  formData: FormData,
): Promise<SaveExamenFisicoSegmentarioActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message:
        "Debes iniciar sesion para guardar el examen fisico segmentario.",
      ok: false,
    };
  }

  const parsed = CreateExamenFisicoSegmentarioSchema.safeParse(
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

    const examenFisicoSegmentario = {
      ...(parsed.data as ExamenFisicoSegmentario),
      created_by: historia.examenFisicoSegmentario?.created_by ?? userId,
      updated_by: userId,
    };
    const nextHistoria = {
      ...historia,
      examenesComplementariosSolicitados:
        getExamenesComplementariosSolicitados(formData),
      examenFisicoSegmentario,
    };

    await db.put(nextHistoria);
    await logStationActivity({
      actorId: userId,
      after: examenFisicoSegmentario,
      before: historia.examenFisicoSegmentario,
      historia,
      stationKey: "examenFisicoSegmentario",
    }).catch(() => undefined);

    revalidatePath(`/estudiante/examen-fisico-segmentario/${idHistoria}`);
    revalidatePath("/estudiante/examen-fisico-segmentario");

    return {
      message: "Examen fisico segmentario guardado correctamente.",
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
          : "No se pudo guardar el examen fisico segmentario.",
      ok: false,
    };
  }
}
