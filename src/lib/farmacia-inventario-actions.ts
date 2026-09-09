"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { logStationActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import {
  canAccessFarmaciaTrip,
  markRecetaEntregada,
} from "@/lib/farmacia";

export async function markRecetaEntregadaAction(
  viajeId: string,
  recetaId: string,
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
    const result = await markRecetaEntregada({ recetaId, userId });

    // Log activity
    const historia = await db.get(result.historiaId).catch(() => null);

    if (
      historia &&
      typeof historia === "object" &&
      "type" in historia &&
      historia.type === "historia" &&
      "_id" in historia
    ) {
      await logStationActivity({
        actorId: userId,
        after: { entregada: true, entregadaAt: result.entregadaAt },
        before: { entregada: false },
        historia: historia as { _id: string; type: "historia"; pacienteId: string; viajeId?: string },
        stationKey: "farmacia",
      });
    }

    revalidatePath("/estudiante/farmacia/inventario");
    revalidatePath("/docente/farmacia/inventario");

    return { ok: true, message: "Receta marcada como entregada." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}


export async function registrarInsumoEntregaAction(
  viajeId: string,
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

  const insumoId = formData.get("insumoId");
  const insumoNombre = formData.get("insumoNombre");
  const cantidadRaw = formData.get("cantidad");
  const pacienteNombre = formData.get("pacienteNombre");
  const observaciones = formData.get("observaciones");

  if (typeof insumoId !== "string" || !insumoId.trim()) {
    return { ok: false, message: "Selecciona un insumo." };
  }

  if (typeof insumoNombre !== "string" || !insumoNombre.trim()) {
    return { ok: false, message: "Nombre de insumo requerido." };
  }

  const cantidad = Number(cantidadRaw);
  if (!Number.isFinite(cantidad) || cantidad < 1) {
    return { ok: false, message: "Cantidad invalida." };
  }

  try {
    const { createInsumoEntrega } = await import("@/lib/farmacia");

    await createInsumoEntrega({
      cantidad,
      insumoId: insumoId.trim(),
      insumoNombre: insumoNombre.trim(),
      observaciones: typeof observaciones === "string" ? observaciones : undefined,
      pacienteNombre: typeof pacienteNombre === "string" ? pacienteNombre : undefined,
      userId,
      viajeId,
    });

    revalidatePath("/estudiante/farmacia/inventario");
    revalidatePath("/docente/farmacia/inventario");
    revalidatePath("/docente/farmacia/ajustes");

    return { ok: true, message: "Entrega de insumo registrada." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error inesperado.",
    };
  }
}
