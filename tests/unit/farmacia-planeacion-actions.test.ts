import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), authorize: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth-session", () => ({ getAuthenticatedUserId: mocks.user }));
vi.mock("@/lib/farmacia", () => ({ authorizeFarmaciaAction: mocks.authorize, updateViajeInventarioItem: mocks.update }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { editarPlaneacionAction } from "@/lib/farmacia-planeacion-actions";
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue("student"); mocks.authorize.mockResolvedValue(true); });
function form() { const data = new FormData(); for (const [key, value] of Object.entries({ cantidadPlanificada: "20", cantidadDisponible: "10", cantidadMinima: "0", unidad: "unidades", lote: "", fechaVencimiento: "", observaciones: "", updatedAt: "version" })) data.set(key, value); return data; }
it("deniega una edición no autorizada antes de persistir", async () => {
  mocks.authorize.mockResolvedValue(false);
  expect((await editarPlaneacionAction("estudiante", "viaje", "item", form())).ok).toBe(false);
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.authorize).toHaveBeenCalledWith({ mode: "estudiante", permission: "plan", userId: "student", viajeId: "viaje" });
});
it("transmite el viaje y versión esperados al servicio y revalida ambas interfaces", async () => {
  expect((await editarPlaneacionAction("estudiante", "viaje", "item", form())).ok).toBe(true);
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ viajeId: "viaje", itemId: "item", expectedUpdatedAt: "version", updates: expect.objectContaining({ cantidadDisponible: 10, cantidadPlanificada: 20 }) }));
  expect(mocks.revalidate).toHaveBeenCalledWith("/estudiante/farmacia", "layout");
});
it("rechaza cantidades inválidas y formularios sin versión", async () => {
  const data = form(); data.set("cantidadDisponible", "-1");
  expect((await editarPlaneacionAction("docente", "viaje", "item", data)).ok).toBe(false);
  data.set("cantidadDisponible", "10"); data.delete("updatedAt");
  expect((await editarPlaneacionAction("docente", "viaje", "item", data)).ok).toBe(false);
  expect(mocks.update).not.toHaveBeenCalled();
});
