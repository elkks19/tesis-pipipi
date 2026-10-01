import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), status: vi.fn(), command: vi.fn(), versions: vi.fn(), resolve: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/auth-session", () => ({ getAuthenticatedUser: mocks.user }));
vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => undefined),
  sanitizeTechnicalMessage: (value: unknown) => value instanceof Error ? value.message : String(value),
}));
vi.mock("@/lib/sync/control.mjs", () => ({ syncStatus: mocks.status, queueCommand: mocks.command, conflictVersions: mocks.versions, resolveConflict: mocks.resolve }));
vi.mock("@/lib/sync/files.mjs", () => ({ resolveFileConflict: mocks.file }));
import { GET, POST } from "@/app/api/admin/sync/[...path]/route";
const context = (path: string) => ({ params: Promise.resolve({ path: [path] }) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("SYNC_ENABLED", "true"); vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", ""); vi.stubEnv("BETTER_AUTH_URL", "https://app.example.test"); mocks.user.mockResolvedValue({ id: "admin", role: "admin" }); mocks.status.mockResolvedValue({ enabled: true }); mocks.command.mockResolvedValue({ state: "pending" }); });
afterEach(() => vi.unstubAllEnvs());
it("protege el estado y comandos por sesión y rol", async () => {
  mocks.user.mockResolvedValueOnce(null);
  expect((await GET(new Request("https://app.example.test/api/admin/sync/status"), context("status"))).status).toBe(401);
  mocks.user.mockResolvedValueOnce({ id: "student", role: "estudiante" });
  expect((await GET(new Request("https://app.example.test/api/admin/sync/status"), context("status"))).status).toBe(403);
  expect(mocks.status).not.toHaveBeenCalled();
});
it("rechaza mutaciones cross-origin", async () => {
  const request = new Request("https://app.example.test/api/admin/sync/commands", { method: "POST", headers: { origin: "https://other.example.test" }, body: JSON.stringify({ action: "sync" }) });
  expect((await POST(request, context("commands"))).status).toBe(403);
  expect(mocks.command).not.toHaveBeenCalled();
});
it("registra una solicitud pendiente sin decir que se ejecutó", async () => {
  const request = new Request("https://app.example.test/api/admin/sync/commands", { method: "POST", headers: { origin: "https://app.example.test" }, body: JSON.stringify({ action: "sync" }) });
  const response = await POST(request, context("commands"));
  expect(response.status).toBe(202); expect(await response.json()).toEqual({ state: "pending" });
  expect(mocks.command).toHaveBeenCalledWith("sync", "admin");
});

it("acepta un origen adicional explícito aunque el proxy use otra URL interna", async () => {
  vi.stubEnv("BETTER_AUTH_URL", "http://laptop:5173");
  vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", " http://localhost:5173, https://tunnel.example.test ");
  const request = new Request("http://internal:3000/api/admin/sync/commands", { method: "POST", headers: { origin: "https://tunnel.example.test" }, body: JSON.stringify({ action: "sync" }) });
  expect((await POST(request, context("commands"))).status).toBe(202);
});
it.each([undefined, "null", "https://app.example.test.evil.test", "http://app.example.test", "https://app.example.test:444"])("rechaza origen ausente o no autorizado: %s", async (origin) => {
  const headers = new Headers({ "x-forwarded-host": "app.example.test" });
  if (origin) headers.set("origin", origin);
  const request = new Request("https://app.example.test/api/admin/sync/commands", { method: "POST", headers, body: JSON.stringify({ action: "sync" }) });
  expect((await POST(request, context("commands"))).status).toBe(403);
  expect(mocks.command).not.toHaveBeenCalled();
});
