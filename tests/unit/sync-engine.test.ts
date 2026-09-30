import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), list: vi.fn(), remote: vi.fn(), replicate: vi.fn(), status: vi.fn(), files: vi.fn(), importAccounts: vi.fn(), conflicts: vi.fn() }));
vi.mock("@/lib/sync/couch.mjs", () => ({ controlGet: mock.get, controlPut: mock.put, controlList: mock.list, remote: mock.remote, ensureControl: vi.fn() }));
vi.mock("@/lib/sync/replication.mjs", () => ({ reconcileReplication: mock.replicate, replicationStatus: mock.status }));
vi.mock("@/lib/sync/files.mjs", () => ({ synchronizeFiles: mock.files }));
vi.mock("@/lib/sync/accounts.mjs", () => ({ importAccounts: mock.importAccounts }));
vi.mock("@/lib/sync/control.mjs", () => ({ conflictList: mock.conflicts }));
import { syncCycle } from "@/lib/sync/engine.mjs";
const docs = new Map<string, Record<string, unknown>>();
beforeEach(() => {
  vi.resetAllMocks(); docs.clear();
  for (const [name, value] of Object.entries({ APP_ENVIRONMENT: "raspberry", SYNC_ENABLED: "true", COUCHDB_URL: "http://app:pass@localhost:5984/tesis", SYNC_CLOUD_APP_URL: "https://app.example.test", SYNC_CLOUD_COUCHDB_URL: "https://db.example.test/tesis", SYNC_CLOUD_COUCHDB_USERNAME: "sync", SYNC_CLOUD_COUCHDB_PASSWORD: "pass", SYNC_SHARED_SECRET: "x".repeat(32), CARBONE_TLS_INSECURE: "false", NODE_TLS_REJECT_UNAUTHORIZED: "1" })) vi.stubEnv(name, value);
  mock.get.mockImplementation(async (id) => docs.get(id) ?? null);
  mock.put.mockImplementation(async (doc) => { docs.set(doc._id, structuredClone(doc)); return { rev: "1" }; });
  mock.list.mockResolvedValue([]);
  mock.status.mockResolvedValue([{ state: "running", pending: 0, failures: 0 }, { state: "running", pending: 0, failures: 0 }]);
  mock.remote.mockImplementation(async (path) => ({ json: async () => path === "state" ? { commands: [] } : { users: [], accounts: [] } }));
  mock.importAccounts.mockReturnValue({ count: 2 });
  mock.files.mockResolvedValue({ pending: 0, conflicts: 0, transferred: 0 });
  mock.conflicts.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());
it("aplica una pausa local aunque la nube no responda", async () => {
  mock.list.mockResolvedValue([{ _id: "command:pause", action: "pause", state: "pending", createdAt: "2026-09-25" }]);
  mock.remote.mockRejectedValue(new Error("offline"));
  const result = await syncCycle();
  expect(mock.replicate).toHaveBeenCalledWith(true, false);
  expect(docs.get("command:pause")?.state).toBe("completed");
  expect(result?.snapshot.paused).toBe(true);
  expect(result?.snapshot.errors.some((e) => e.stage === "connection")).toBe(true);
});
it("revisa archivos y datos aunque falle la importación de cuentas", async () => {
  mock.importAccounts.mockImplementation(() => { throw new Error("secret database path"); });
  const result = await syncCycle();
  expect(mock.files).toHaveBeenCalled();
  expect(result?.snapshot.replication).toHaveLength(2);
  expect(result?.snapshot.accounts).toBeNull();
  expect(result?.snapshot.errors).toEqual([expect.objectContaining({ stage: "accounts" })]);
  expect(JSON.stringify(result)).not.toContain("secret database path");
});
it("confirma la pausa remota sin depender de archivos o cuentas", async () => {
  mock.remote.mockImplementation(async (path) => ({ json: async () => path === "state" ? { commands: [{ _id: "command:pause", action: "pause", createdAt: "2026-09-25" }] } : {} }));
  await syncCycle();
  expect(mock.remote).toHaveBeenCalledWith("ack", { method: "POST", body: { id: "command:pause", state: "completed" } });
  expect(mock.files).not.toHaveBeenCalled(); expect(mock.importAccounts).not.toHaveBeenCalled();
});
it("un acuse perdido no vuelve a aplicar una pausa sobre una reanudación posterior", async () => {
  docs.set("settings", { _id: "settings", paused: false });
  docs.set("applied:command:pause", { _id: "applied:command:pause" });
  mock.remote.mockImplementation(async (path) => ({ json: async () => path === "state" ? { commands: [{ _id: "command:pause", action: "pause", createdAt: "2026-09-25" }] } : {} }));
  const result = await syncCycle();
  expect(result?.snapshot.paused).toBe(false);
  expect(mock.replicate).not.toHaveBeenCalledWith(true, false);
  expect(mock.remote).toHaveBeenCalledWith("ack", expect.anything());
});
it("descarta órdenes antiguas de control de viaje sin bloquear ni asignar viajes", async () => {
  mock.list.mockResolvedValue([{ _id: "command:old", action: "prepare", state: "pending", createdAt: "2026-09-25" }]);
  await syncCycle();
  expect(docs.get("command:old")?.state).toBe("cancelled");
  expect([...docs.keys()].some((id) => id.startsWith("trip:"))).toBe(false);
  expect(mock.remote.mock.calls.some(([path]) => path === "handoff")).toBe(false);
});
