import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), bulkDocs: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: mocks }));
vi.mock("@/lib/db-find", () => ({ findTesisDocs: vi.fn() }));
vi.mock("@/lib/db-indexes", () => ({ ensureTesisIndexes: vi.fn() }));
import { updateViajeInventarioItem } from "@/lib/farmacia";
const item = { _id: "item", id: "item", type: "viajeInventarioItem", viajeId: "viaje", cantidadInicial: 10, cantidadDisponible: 10, cantidadPlanificada: 10, updatedAt: "v1" };
beforeEach(() => { vi.resetAllMocks(); mocks.get.mockResolvedValue(item); mocks.bulkDocs.mockImplementation(async (docs) => docs.map(() => ({ ok: true }))); });
it("rechaza un item de otro viaje incluso con un ID válido", async () => {
  await expect(updateViajeInventarioItem({ itemId: "item", viajeId: "otro", userId: "student", updates: { cantidadDisponible: 20 } })).rejects.toThrow("no encontrado");
  expect(mocks.bulkDocs).not.toHaveBeenCalled();
});
it("rechaza un formulario obsoleto", async () => {
  await expect(updateViajeInventarioItem({ itemId: "item", viajeId: "viaje", userId: "student", expectedUpdatedAt: "old", updates: { cantidadDisponible: 20 } })).rejects.toThrow("cambió");
  expect(mocks.bulkDocs).not.toHaveBeenCalled();
});
it("valida la dirección de entradas contra el saldo del servidor", async () => {
  await expect(updateViajeInventarioItem({ itemId: "item", viajeId: "viaje", userId: "teacher", updates: { cantidadDisponible: 5, tipo: "entrada" } })).rejects.toThrow("no puede reducir");
  expect(mocks.bulkDocs).not.toHaveBeenCalled();
});
it("actualiza la preparación y registra el delta de existencias", async () => {
  await updateViajeInventarioItem({ itemId: "item", viajeId: "viaje", userId: "student", expectedUpdatedAt: "v1", updates: { cantidadDisponible: 15, cantidadPlanificada: 20, lote: "L2", motivo: "Preparación" } });
  const docs = mocks.bulkDocs.mock.calls[0][0];
  expect(docs[0]).toMatchObject({ cantidadDisponible: 15, cantidadPlanificada: 20, lote: "L2", viajeId: "viaje" });
  expect(docs[1]).toMatchObject({ type: "inventarioMovimiento", cantidad: 5, viajeId: "viaje", inventarioItemId: "item", createdBy: "student" });
});
