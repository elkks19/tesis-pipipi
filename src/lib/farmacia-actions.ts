"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import {
  authorizeFarmaciaAction,
  createViajeInventarioItem,
  type FarmaciaAccessMode,
} from "@/lib/farmacia";
import { CreateViajeInventarioItemSchema } from "@/lib/schema";

export type AddInventarioItemActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function optionalString(formData: FormData, key: string) {
  const value = getString(formData, key);

  return value || undefined;
}

function getPayload(formData: FormData) {
  const categoria = getString(formData, "categoria");
  const fuente = getString(formData, "fuente");

  return {
    atcCode: optionalString(formData, "atcCode"),
    cantidadDisponible: getString(formData, "cantidadDisponible") || undefined,
    cantidadMinima: getString(formData, "cantidadMinima") || "0",
    cantidadPlanificada: getString(formData, "cantidadPlanificada"),
    catalogoId: optionalString(formData, "catalogoId"),
    categoria,
    concentracion: optionalString(formData, "concentracion"),
    condicion: getString(formData, "condicion") || "disponible",
    fechaVencimiento: optionalString(formData, "fechaVencimiento"),
    formaFarmaceutica: optionalString(formData, "formaFarmaceutica"),
    fuente: fuente || undefined,
    laboratorio: optionalString(formData, "laboratorio"),
    lote: optionalString(formData, "lote"),
    nombre: getString(formData, "nombre"),
    nombreComercial: optionalString(formData, "nombreComercial"),
    manualMotivo: optionalString(formData, "manualMotivo"),
    observaciones: optionalString(formData, "observaciones"),
    principioActivo: optionalString(formData, "principioActivo"),
    registroSanitario: optionalString(formData, "registroSanitario"),
    titularRegistro: optionalString(formData, "titularRegistro"),
    unidad: getString(formData, "unidad"),
    viaAdministracion: optionalString(formData, "viaAdministracion"),
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

export async function addViajeInventarioItem(
  mode: FarmaciaAccessMode,
  viajeId: string,
  _previousState: AddInventarioItemActionState,
  formData: FormData,
): Promise<AddInventarioItemActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para planificar el inventario.",
      ok: false,
    };
  }

  const canAccess = await authorizeFarmaciaAction({ mode, permission: "plan", userId, viajeId });

  if (!canAccess) {
    return {
      message: "No puedes modificar inventario de un viaje fuera de Farmacia.",
      ok: false,
    };
  }

  const parsed = CreateViajeInventarioItemSchema.safeParse(
    getPayload(formData),
  );

  if (!parsed.success) {
    return {
      errors: getFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar.",
      ok: false,
    };
  }

  await createViajeInventarioItem({
    item: parsed.data,
    userId,
    viajeId,
  });

  revalidatePath("/estudiante/farmacia/planeacion");
  revalidatePath("/docente/farmacia/planeacion");

  return {
    message: "Item agregado al inventario del viaje.",
    ok: true,
  };
}
