import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn(), put: vi.fn(), all: vi.fn(), ensure: vi.fn() }));
vi.mock("@/lib/sync/couch.mjs", () => ({ controlGet: mocks.get, controlList: mocks.list, controlPut: mocks.put, allDocuments: mocks.all, ensureControl: mocks.ensure, couch: vi.fn() }));
import { queueCommand, syncStatus, conflictList } from "@/lib/sync/control.mjs";
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("APP_ENVIRONMENT", "cloud"); vi.stubEnv("SYNC_ENABLED", "true"); vi.stubEnv("SYNC_SHARED_SECRET", "x".repeat(32)); vi.stubEnv("COUCHDB_URL", "http://local/app"); vi.stubEnv("CARBONE_TLS_INSECURE", "false"); vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "1");
  mocks.get.mockResolvedValue(null); mocks.list.mockResolvedValue([]); mocks.all.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());
it.each(["prepare", "return"])("rechaza la orden eliminada %s sin escribir ningún bloqueo", async (action) => {
  await expect(queueCommand(action, "admin")).rejects.toThrow("Acción inválida");
  expect(mocks.put).not.toHaveBeenCalled();
});
it("mantiene el panel disponible si falla CouchDB y no inventa conexión", async () => {
  mocks.get.mockRejectedValue(new Error("credential-secret"));
  const status = await syncStatus();
  expect(status.stale).toBe(true); expect(status.snapshot).toBeNull();
  expect(status.diagnostics).toEqual([expect.objectContaining({ stage: "control" })]);
  expect(JSON.stringify(status)).not.toContain("credential-secret");
});
it("obtiene conflictos de las revisiones nativas de los documentos", async () => {
  mocks.all.mockResolvedValue([{ _id: "history", _rev: "2-a", _conflicts: ["2-b"] }, { _id: "clean", _rev: "1-c" }]);
  expect(await conflictList()).toEqual([{ id: "history", type: "documento", revisions: ["2-a", "2-b"] }]);
  expect(mocks.all).toHaveBeenCalledWith(true);
});
