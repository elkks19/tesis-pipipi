import { afterEach, beforeEach, expect, it, vi } from "vitest";
const couch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sync/couch.mjs", () => ({ couch }));
import { reconcileReplication, replicationStatus } from "@/lib/sync/replication.mjs";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("COUCHDB_URL", "http://u:p@local:5984/app");
  vi.stubEnv("SYNC_CLOUD_COUCHDB_URL", "https://remote.test/app");
  vi.stubEnv("SYNC_NODE_ID", "raspberry-01");
});
afterEach(() => vi.unstubAllEnvs());
it("reanuda los mismos identificadores usando la revisión borrada, sin trabajos duplicados", async () => {
  couch.mockImplementation(async (path, options) => options?.method === "PUT" ? { ok: true } : path.includes("_all_docs") ? { rows: [{ value: { rev: "3-deleted", deleted: true } }] } : null);
  await reconcileReplication(false);
  const writes = couch.mock.calls.filter(([, options]) => options?.method === "PUT");
  expect(writes).toHaveLength(2);
  expect(writes.map(([path]) => path)).toEqual(["_replicator/tesis-raspberry-01-push", "_replicator/tesis-raspberry-01-pull"]);
  for (const [, options] of writes) expect(options.body._rev).toBe("3-deleted");
});
it("lee contadores del trabajo activo aunque el documento tenga info vacía", async () => {
  couch.mockImplementation(async (path) => path.startsWith("_scheduler/docs") ? { id: "job", state: "running", info: {} } : { info: { changes_pending: 7, docs_written: 3, doc_write_failures: 0 } });
  expect(await replicationStatus()).toEqual([expect.objectContaining({ pending: 7, written: 3, failures: 0 }), expect.objectContaining({ pending: 7, written: 3, failures: 0 })]);
});
it("no presenta mediciones ausentes como cero", async () => {
  couch.mockResolvedValue(null);
  expect((await replicationStatus())[0]).toMatchObject({ pending: null, failures: null, state: "not_started" });
});
