"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import {
  authorizeFarmaciaAction,
  deleteViajeInventarioItem,
  updateViajeInventarioItem,
} from "@/lib/farmacia";
import { AjustarInventarioSchema } from "@/lib/schema/farmacia";

export async function updateInventarioItemAction(
  mode: "docente",
  viajeId: string,
  itemId: string,
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { ok: false, message: "Debes iniciar sesion." };
  }

  const canAccess = await authorizeFarmaciaAction({ mode, permission: "adjust", userId, viajeId });

  if (!canAccess) {
    return { ok: false, message: "No tienes acceso a este viaje." };
  }

  const cantidadRaw = formData.get("cantidadDisponible");
  const condicion = formData.get("condicion");
  const motivo = formData.get("motivo");
  const tipo = formData.get("tipo");

  const updates: {
    cantidadDisponible?: number;
    condicion?: "disponible" | "cuarentena" | "danado" | "vencido";
    motivo?: string;
    tipo?: "entrada" | "ajuste" | "devolucion" | "merma";
    nombre?: string;
    observaciones?: string;
  } = {};

  const parsed = AjustarInventarioSchema.safeParse({ cantidadObjetivo: cantidadRaw, condicion, motivo, tipo });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el ajuste." };
  const currentQuantity = Number(formData.get("cantidadActual"));
  if (["entrada", "devolucion"].includes(parsed.data.tipo) && parsed.data.cantidadObjetivo < currentQuantity) return { ok: false, message: "Una entrada o devolucion no puede reducir la existencia." };
  if (parsed.data.tipo === "merma" && parsed.data.cantidadObjetivo > currentQuantity) return { ok: false, message: "Una merma no puede aumentar la existencia." };
  updates.cantidadDisponible = parsed.data.cantidadObjetivo;
  updates.condicion = parsed.data.condicion;
  updates.motivo = parsed.data.motivo;
  updates.tipo = parsed.data.tipo;

  try {
    await updateViajeInventarioItem({ itemId, updates, userId });
    revalidatePath("/docente/farmacia/ajustes");
    revalidatePath("/docente/farmacia/inventario");
    revalidatePath("/estudiante/farmacia/inventario");
    return { ok: true, message: "Item actualizado." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}

export async function deleteInventarioItemAction(
  mode: "docente",
  viajeId: string,
  itemId: string,
): Promise<{ ok: boolean; message?: string }> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { ok: false, message: "Debes iniciar sesion." };
  }

  const canAccess = await authorizeFarmaciaAction({ mode, permission: "plan", userId, viajeId });

  if (!canAccess) {
    return { ok: false, message: "No tienes acceso a este viaje." };
  }

  try {
    await deleteViajeInventarioItem({ itemId, userId });
    revalidatePath("/docente/farmacia/ajustes");
    revalidatePath("/docente/farmacia/inventario");
    revalidatePath("/estudiante/farmacia/inventario");
    return { ok: true, message: "Item eliminado." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}
