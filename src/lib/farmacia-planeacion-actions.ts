"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { authorizeFarmaciaAction, updateViajeInventarioItem, type FarmaciaAccessMode } from "@/lib/farmacia";
import { EditarPlaneacionSchema } from "@/lib/schema/farmacia";

export async function editarPlaneacionAction(mode: FarmaciaAccessMode, viajeId: string, itemId: string, data: FormData) {
  const userId = await getAuthenticatedUserId();
  if (!userId || !await authorizeFarmaciaAction({ mode, permission: "plan", userId, viajeId })) {
    return { ok: false, message: "La edición solo está disponible antes del inicio del viaje para las personas asignadas a Farmacia." };
  }
  const parsed = EditarPlaneacionSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const expectedUpdatedAt = data.get("updatedAt");
  if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) return { ok: false, message: "Recarga el inventario antes de editar." };
  try {
    await updateViajeInventarioItem({ itemId, viajeId, expectedUpdatedAt, userId, updates: { ...parsed.data, tipo: "ajuste", motivo: "Edición de la preparación antes del viaje" } });
    revalidatePath("/estudiante/farmacia", "layout");
    revalidatePath("/docente/farmacia", "layout");
    return { ok: true, message: "Producto actualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo guardar." };
  }
}
