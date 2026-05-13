"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import {
  CreateLaboratoriosSchema,
  type Laboratorios,
} from "@/lib/schema/laboratorios";
import type { Historia } from "@/lib/schema/historia";

export type SaveLaboratoriosActionState = {
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

function getStudyIndexes(formData: FormData) {
  const indexes = new Set<number>();

  for (const key of formData.keys()) {
    const match = key.match(/^otrosEstudios\.(\d+)\./);

    if (match) {
      indexes.add(Number(match[1]));
    }
  }

  return [...indexes].sort((a, b) => a - b);
}

function getPayload(formData: FormData) {
  const otrosEstudios = getStudyIndexes(formData)
    .map((index) => ({
      nombre: getString(formData, `otrosEstudios.${index}.nombre`),
      resultado: getString(formData, `otrosEstudios.${index}.resultado`),
    }))
    .filter((estudio) => estudio.nombre || estudio.resultado);

  return {
    glicemiaCapilar: getString(formData, "glicemiaCapilar"),
    grupoSanguineo: getString(formData, "grupoSanguineo"),
    ...(otrosEstudios.length > 0 ? { otrosEstudios } : {}),
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

export async function saveLaboratorios(
  idHistoria: string,
  _previousState: SaveLaboratoriosActionState,
  formData: FormData,
): Promise<SaveLaboratoriosActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para guardar laboratorios.",
      ok: false,
    };
  }

  const parsed = CreateLaboratoriosSchema.safeParse(getPayload(formData));

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
      historia.examenesComplementariosSolicitados?.laboratorios,
    );

    if (!isRequested && !historia.laboratorios) {
      return {
        message: "Esta historia no tiene laboratorios solicitados.",
        ok: false,
      };
    }

    await db.put({
      ...historia,
      laboratorios: {
        ...(parsed.data as Laboratorios),
        created_by: historia.laboratorios?.created_by ?? userId,
        updated_by: userId,
      },
    });

    revalidatePath(`/estudiante/laboratorios/${idHistoria}`);
    revalidatePath("/estudiante/laboratorios");

    return {
      message: "Laboratorios guardados correctamente.",
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
          : "No se pudieron guardar los laboratorios.",
      ok: false,
    };
  }
}
