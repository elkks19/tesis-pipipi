"use server";

import { revalidatePath } from "next/cache";

import { logStationActivity } from "@/lib/activity-log";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { saveHistoriaReceta } from "@/lib/farmacia";
import { enqueueReporteHistoria } from "@/lib/queues/reportes";
import {
  CreateDiagnosticoSchema,
  type Diagnostico,
  type DiagnosticoCie11,
} from "@/lib/schema/diagnostico";
import { CreateRecetaSchema, type RecetaMedicamento } from "@/lib/schema/farmacia";
import type { Historia } from "@/lib/schema/historia";
import { canAccessActiveStationHistoria } from "@/lib/station-histories";

export type SaveDiagnosticoActionState = {
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

function getIcdValue(formData: FormData, baseName: string): DiagnosticoCie11 {
  return {
    code: getString(formData, `${baseName}.code`),
    iNo: getString(formData, `${baseName}.iNo`),
    title: getString(formData, `${baseName}.title`),
  };
}

function getSecondaryIndexes(formData: FormData) {
  const indexes = new Set<number>();

  for (const key of formData.keys()) {
    const match = key.match(/^secundarios\.(\d+)\./);

    if (match) {
      indexes.add(Number(match[1]));
    }
  }

  return [...indexes].sort((a, b) => a - b);
}

function getRecetaMedicationIndexes(formData: FormData) {
  const indexes = new Set<number>();

  for (const key of formData.keys()) {
    const match = key.match(/^receta\.medicamentos\.(\d+)\./);

    if (match) {
      indexes.add(Number(match[1]));
    }
  }

  return [...indexes].sort((a, b) => a - b);
}

function optionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value || undefined;
}

function optionalNumber(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value ? Number(value) : undefined;
}

function getRecetaPayload(formData: FormData) {
  return {
    indicacionesGenerales: optionalString(formData, "receta.indicacionesGenerales"),
    medicamentos: getRecetaMedicationIndexes(formData)
      .map((index) => ({
        cantidad: optionalNumber(formData, `receta.medicamentos.${index}.cantidad`),
        catalogoId: optionalString(formData, `receta.medicamentos.${index}.catalogoId`),
        concentracion: optionalString(formData, `receta.medicamentos.${index}.concentracion`),
        dosis: getString(formData, `receta.medicamentos.${index}.dosis`),
        duracion: getString(formData, `receta.medicamentos.${index}.duracion`),
        formaFarmaceutica: optionalString(formData, `receta.medicamentos.${index}.formaFarmaceutica`),
        frecuencia: getString(formData, `receta.medicamentos.${index}.frecuencia`),
        indicaciones: optionalString(formData, `receta.medicamentos.${index}.indicaciones`),
        inventarioItemId: optionalString(formData, `receta.medicamentos.${index}.inventarioItemId`),
        nombre: getString(formData, `receta.medicamentos.${index}.nombre`),
        principioActivo: optionalString(formData, `receta.medicamentos.${index}.principioActivo`),
        unidad: optionalString(formData, `receta.medicamentos.${index}.unidad`),
        viaAdministracion: optionalString(formData, `receta.medicamentos.${index}.viaAdministracion`),
      }))
      .filter((medicamento) => medicamento.nombre || medicamento.dosis || medicamento.frecuencia || medicamento.duracion),
  };
}

function getPayload(idHistoria: string, formData: FormData) {
  const recetaId = getString(formData, "recetaId");

  return {
    historiaId: idHistoria,
    principal: getIcdValue(formData, "principal"),
    secundarios: getSecondaryIndexes(formData)
      .map((index) => getIcdValue(formData, `secundarios.${index}`))
      .filter((diagnostico) => diagnostico.iNo || diagnostico.title),
    planTrabajo: getString(formData, "planTrabajo"),
    ...(recetaId ? { recetaId } : {}),
  };
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

function prefixErrorKeys(errors: Record<string, string>, prefix: string) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [`${prefix}.${key}`, value]),
  );
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

function getDiagnosticoFingerprint(diagnostico: Diagnostico) {
  return JSON.stringify({
    planTrabajo: diagnostico.planTrabajo,
    principal: diagnostico.principal,
    recetaId: diagnostico.recetaId ?? "",
    secundarios: diagnostico.secundarios,
  });
}

function revalidateDiagnosticoPaths(idHistoria: string) {
  revalidatePath(`/estudiante/diagnostico/${idHistoria}`);
  revalidatePath("/estudiante/diagnostico");
  revalidatePath(`/docente/diagnostico/${idHistoria}`);
  revalidatePath("/docente/diagnostico");
}

export async function saveDiagnostico(
  idHistoria: string,
  _previousState: SaveDiagnosticoActionState,
  formData: FormData,
): Promise<SaveDiagnosticoActionState> {
  void _previousState;

  const user = await getAuthenticatedUser();
  const userId = user?.id;

  if (!userId) {
    return {
      message: "Debes iniciar sesion para guardar el diagnostico.",
      ok: false,
    };
  }

  const parsed = CreateDiagnosticoSchema.safeParse(
    getPayload(idHistoria, formData),
  );
  const recetaPayload = getRecetaPayload(formData);
  const parsedReceta = CreateRecetaSchema.safeParse(recetaPayload);

  if (!parsed.success) {
    return {
      errors: getFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar.",
      ok: false,
    };
  }

  if (!parsedReceta.success) {
    return {
      errors: prefixErrorKeys(getFieldErrors(parsedReceta.error), "receta"),
      message: "Revisa los campos de la receta antes de guardar.",
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
      stationKey: "diagnostico",
      userId,
    });

    if (!canEdit) {
      return {
        message: "No puedes editar una historia fuera de tu viaje activo.",
        ok: false,
      };
    }

    const receta =
      parsedReceta.data.medicamentos.length > 0
        ? await saveHistoriaReceta({
            historia,
            indicacionesGenerales: parsedReceta.data.indicacionesGenerales,
            medicamentos: parsedReceta.data.medicamentos as RecetaMedicamento[],
            recetaId: parsed.data.recetaId,
            userId,
          })
        : null;
    const diagnostico = {
      ...(parsed.data as Diagnostico),
      ...(receta ? { recetaId: receta.id } : {}),
      created_by: historia.diagnostico?.created_by ?? userId,
      updated_by: userId,
    };
    const nextHistoria = {
      ...historia,
      diagnostico,
    };

    console.info("[diagnostico] saving diagnostico", {
      hasPreviousDiagnostico: Boolean(historia.diagnostico),
      historiaId: idHistoria,
      userId,
    });

    await db.put(nextHistoria);
    await logStationActivity({
      actorId: userId,
      after: diagnostico,
      before: historia.diagnostico,
      historia,
      stationKey: "diagnostico",
    }).catch(() => undefined);

    try {
      console.info("[diagnostico] enqueueing history report", {
        historiaId: idHistoria,
        userId,
      });

      await enqueueReporteHistoria({
        diagnosticoFingerprint: getDiagnosticoFingerprint(diagnostico),
        historiaId: idHistoria,
        requestedBy: userId,
        requestedByName: user.name ?? user.email ?? userId,
      });
    } catch (error) {
      console.error("[diagnostico] report enqueue failed", {
        error,
        historiaId: idHistoria,
        userId,
      });

      revalidateDiagnosticoPaths(idHistoria);

      return {
        message:
          "Diagnostico guardado, pero no se pudo encolar el reporte.",
        ok: true,
      };
    }

    console.info("[diagnostico] diagnostico saved and report queued", {
      historiaId: idHistoria,
      userId,
    });

    revalidateDiagnosticoPaths(idHistoria);

    return {
      message: "Diagnostico guardado. Reporte enviado a generacion.",
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
          : "No se pudo guardar el diagnostico.",
      ok: false,
    };
  }
}
