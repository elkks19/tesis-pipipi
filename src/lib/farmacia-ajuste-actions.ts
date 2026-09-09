"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import {
  canAccessFarmaciaTrip,
  deleteViajeInventarioItem,
  updateViajeInventarioItem,
} from "@/lib/farmacia";

export async function updateInventarioItemAction(
  viajeId: string,
  itemId: string,
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { ok: false, message: "Debes iniciar sesion." };
  }

  const canAccess = await canAccessFarmaciaTrip({ userId, viajeId });

  if (!canAccess) {
    return { ok: false, message: "No tienes acceso a este viaje." };
  }

  const cantidadRaw = formData.get("cantidadDisponible");
  const nombre = formData.get("nombre");
  const observaciones = formData.get("observaciones");

  const updates: {
    cantidadDisponible?: number;
    nombre?: string;
    observaciones?: string;
  } = {};

  if (typeof cantidadRaw === "string" && cantidadRaw.trim() !== "") {
    const parsed = Number(cantidadRaw);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      updates.cantidadDisponible = parsed;
    }
  }

  if (typeof nombre === "string" && nombre.trim()) {
    updates.nombre = nombre.trim();
  }

  if (typeof observaciones === "string") {
    updates.observaciones = observaciones.trim();
  }

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
  viajeId: string,
  itemId: string,
): Promise<{ ok: boolean; message?: string }> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { ok: false, message: "Debes iniciar sesion." };
  }

  const canAccess = await canAccessFarmaciaTrip({ userId, viajeId });

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
