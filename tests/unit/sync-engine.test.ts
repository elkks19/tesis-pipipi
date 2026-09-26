import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), list: vi.fn(), couch: vi.fn(), remote: vi.fn(), replicate: vi.fn(), status: vi.fn(), files: vi.fn(), importAccounts: vi.fn(), conflicts: vi.fn() }));
vi.mock("@/lib/sync/couch.mjs", () => ({ controlGet: mock.get, controlPut: mock.put, controlList: mock.list, couch: mock.couch, remote: mock.remote, ensureControl: vi.fn() }));
vi.mock("@/lib/sync/replication.mjs", () => ({ reconcileReplication: mock.replicate, replicationStatus: mock.status }));
vi.mock("@/lib/sync/files.mjs", () => ({ synchronizeFiles: mock.files }));
vi.mock("@/lib/sync/accounts.mjs", () => ({ importAccounts: mock.importAccounts }));
vi.mock("@/lib/sync/control.mjs", () => ({ conflictList: mock.conflicts }));
import { syncCycle } from "@/lib/sync/engine.mjs";
beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, value] of Object.entries({ APP_ENVIRONMENT: "raspberry", SYNC_ENABLED: "true", COUCHDB_URL: "http://app:pass@localhost:5984/tesis", SYNC_CLOUD_APP_URL: "https://app.example.test", SYNC_CLOUD_COUCHDB_URL: "https://db.example.test/tesis", SYNC_CLOUD_COUCHDB_USERNAME: "sync", SYNC_CLOUD_COUCHDB_PASSWORD: "pass", SYNC_SHARED_SECRET: "x".repeat(32), CARBONE_TLS_INSECURE: "false", NODE_TLS_REJECT_UNAUTHORIZED: "1" })) vi.stubEnv(name, value);
  mock.get.mockResolvedValue(null); mock.list.mockResolvedValue([]); mock.status.mockResolvedValue([]); mock.remote.mockRejectedValue(new Error("offline"));
});
afterEach(() => vi.unstubAllEnvs());
it("una pausa local funciona sin acceso a la nube y se registra como aplicada", async () => {
  const settings = { _id: "settings", paused: false };
  mock.get.mockImplementation(async (id) => id === "settings" ? settings : null);
  mock.list.mockResolvedValue([{ _id: "command:pause", action: "pause", state: "pending", createdAt: "2026-09-25" }]);
  const result = await syncCycle();
  expect(mock.replicate).toHaveBeenCalledWith(true, false);
  expect(mock.put).toHaveBeenCalledWith(expect.objectContaining({ _id: "command:pause", state: "completed" }));
  expect(result?.snapshot.paused).toBe(true);
  expect(result?.snapshot.error).toBeTruthy();
});
it("no devuelve control por un ciclo incompleto", async () => {
  await syncCycle();
  expect(mock.remote.mock.calls.some(([path]) => path === "handoff")).toBe(false);
});
it("confirma una entrega ya completada aunque se haya perdido el acuse anterior", async () => {
  const command = { _id: "command:return", action: "return", tripId: "viaje:1", state: "pending", createdAt: "2026-09-25" };
  mock.remote.mockImplementation(async (path) => ({ json: async () => path === "state" ? { trips: [{ _id: "trip:viaje:1", tripId: "viaje:1", phase: "cloud" }], commands: [command] } : { users: [], accounts: [] } }));
  mock.importAccounts.mockReturnValue({ count: 0 });
  mock.files.mockResolvedValue({ pending: 0, conflicts: 0 });
  mock.conflicts.mockResolvedValue([]);
  mock.couch.mockResolvedValue({ update_seq: "1" });
  const result = await syncCycle();
  expect(result?.snapshot.error).toBeNull();
  expect(mock.remote).toHaveBeenCalledWith("ack", { method: "POST", body: { id: command._id } });
  expect(mock.remote.mock.calls.some(([path]) => path === "handoff")).toBe(false);
});
