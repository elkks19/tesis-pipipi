"use server";

import { revalidatePath } from "next/cache";

import { logStationActivity } from "@/lib/activity-log";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { putFile } from "@/lib/file-storage";
import {
  CreateEcografiaSchema,
  type Ecografia,
} from "@/lib/schema/ecografia";
import type { Historia } from "@/lib/schema/historia";
import { canAccessActiveStationHistoria } from "@/lib/station-histories";

export type SaveEcografiaActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type HistoriaDocument = Historia & {
  _id: string;
  _rev: string;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

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

async function storeImage(formData: FormData) {
  const file = formData.get("imagen");

  if (!(file instanceof File) || file.size === 0) {
    return undefined;
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("La foto de ecografia debe ser una imagen.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("La foto de ecografia no debe superar 5 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = sanitizeFileName(file.name) || "ecografia";
  const key = `ecografias/${crypto.randomUUID()}-${fileName}`;

  await putFile({
    bytes,
    contentType: file.type,
    key,
  });

  return {
    key,
    nombre: file.name,
    tipo: file.type,
    tamano: file.size,
  };
}

async function getPayload(idHistoria: string, formData: FormData) {
  return {
    historiaId: idHistoria,
    imagen: await storeImage(formData),
    higado: {
      dimensiones: requiredNumber(formData, "higado.dimensiones"),
      hepatomegalia: requiredBoolean(formData, "higado.hepatomegalia"),
      parenquima: getString(formData, "higado.parenquima"),
      diagnostico: getString(formData, "higado.diagnostico"),
    },
    vesiculaBiliar: {
      paredes: getString(formData, "vesiculaBiliar.paredes"),
      contenidoAnecoico: requiredBoolean(
        formData,
        "vesiculaBiliar.contenidoAnecoico",
      ),
      barroBiliar: requiredBoolean(formData, "vesiculaBiliar.barroBiliar"),
      calculos: requiredBoolean(formData, "vesiculaBiliar.calculos"),
      diagnostico: getString(formData, "vesiculaBiliar.diagnostico"),
    },
    riñones: {
      derecho: {
        longitud: requiredNumber(formData, "riñones.derecho.longitud"),
        parenquima: requiredNumber(formData, "riñones.derecho.parenquima"),
      },
      izquierdo: {
        longitud: requiredNumber(formData, "riñones.izquierdo.longitud"),
        parenquima: requiredNumber(formData, "riñones.izquierdo.parenquima"),
      },
      ecogenicidad: getString(formData, "riñones.ecogenicidad"),
      relacionCorticoMedular: getString(
        formData,
        "riñones.relacionCorticoMedular",
      ),
      diagnostico: getString(formData, "riñones.diagnostico"),
    },
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

export async function saveEcografia(
  idHistoria: string,
  _previousState: SaveEcografiaActionState,
  formData: FormData,
): Promise<SaveEcografiaActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para guardar la ecografia.",
      ok: false,
    };
  }

  let payload: Awaited<ReturnType<typeof getPayload>>;

  try {
    payload = await getPayload(idHistoria, formData);
  } catch (error) {
    return {
      errors: {
        imagen:
          error instanceof Error
            ? error.message
            : "No se pudo procesar la imagen.",
      },
      message: "Revisa la imagen antes de guardar.",
      ok: false,
    };
  }

  const parsed = CreateEcografiaSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      errors: getFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar.",
      ok: false,
    };
  }

  const ecografiaData = {
    imagen: parsed.data.imagen,
    higado: parsed.data.higado,
    vesiculaBiliar: parsed.data.vesiculaBiliar,
    riñones: parsed.data.riñones,
  };

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
      stationKey: "ecografia",
      userId,
    });

    if (!canEdit) {
      return {
        message: "No puedes editar una historia fuera de tu viaje activo.",
        ok: false,
      };
    }

    const isRequested = historia.examenesComplementariosSolicitados?.ecografia === true;
    if (!isRequested && !historia.ecografia) {
      return {
        message: "Esta historia no tiene ecografía solicitada.",
        ok: false,
      };
    }

    const ecografia = {
      ...(ecografiaData as Ecografia),
      imagen: ecografiaData.imagen ?? historia.ecografia?.imagen,
      created_by: historia.ecografia?.created_by ?? userId,
      updated_by: userId,
    };
    const nextHistoria = {
      ...historia,
      ecografia,
    };

    await db.put(nextHistoria);
    await logStationActivity({
      actorId: userId,
      after: ecografia,
      before: historia.ecografia,
      historia,
      stationKey: "ecografia",
    }).catch(() => undefined);

    revalidatePath(`/estudiante/ecografia/${idHistoria}`);
    revalidatePath("/estudiante/ecografia");

    return {
      message: "Ecografia guardada correctamente.",
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
          : "No se pudo guardar la ecografia.",
      ok: false,
    };
  }
}
