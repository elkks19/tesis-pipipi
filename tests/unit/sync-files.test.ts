import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const controls = vi.hoisted(() => new Map());
vi.mock("@/lib/sync/couch.mjs", () => ({ controlGet: async (id: string) => controls.get(id), controlPut: async (doc: { _id: string }) => controls.set(doc._id, doc), controlList: async () => [...controls.values()], allDocuments: async () => [], remote: vi.fn() }));
import { verifiedReceive } from "@/lib/sync/files.mjs";
let root: string;
const info = (content: string) => ({ size: Buffer.byteLength(content), sha256: createHash("sha256").update(content).digest("hex") });
beforeEach(() => { controls.clear(); root = mkdtempSync(join(tmpdir(), "tesis-sync-files-")); vi.stubEnv("APP_ENVIRONMENT", "raspberry"); vi.stubEnv("FILE_STORAGE_ROOT", root); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });
it("publica solo archivos completos y verificados", async () => {
  await verifiedReceive("images/file.txt", Readable.from(["hello"]), info("hello"));
  expect(readFileSync(join(root, "images/file.txt"), "utf8")).toBe("hello");
  await expect(verifiedReceive("images/bad.txt", Readable.from(["hel"]), info("hello"))).rejects.toThrow();
  expect(existsSync(join(root, "images/bad.txt"))).toBe(false);
});
it("conserva el original y el candidato cuando sus contenidos difieren", async () => {
  mkdirSync(join(root, "images")); writeFileSync(join(root, "images/file.txt"), "original");
  const result = await verifiedReceive("images/file.txt", Readable.from(["candidate"]), info("candidate"));
  expect(result.conflict).toBe(true);
  expect(readFileSync(join(root, "images/file.txt"), "utf8")).toBe("original");
  expect(controls.size).toBe(1);
});
it("una resolución obsoleta no reemplaza el archivo", async () => {
  writeFileSync(join(root, "file.txt"), "newer");
  await expect(verifiedReceive("file.txt", Readable.from(["candidate"]), info("candidate"), undefined, info("old").sha256)).rejects.toThrow("cambió");
  expect(readFileSync(join(root, "file.txt"), "utf8")).toBe("newer");
});
