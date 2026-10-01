import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  session: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/agent-usage", () => ({
  agentUsageErrorCode: vi.fn(),
  logAgentUsage: vi.fn(async () => undefined),
}));
vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => undefined),
  sanitizeTechnicalMessage: (value: unknown) => String(value),
}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { GET, POST } from "@/app/api/data-science/[...path]/route";

const context = (path: string) => ({ params: Promise.resolve({ path: [path] }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(Response.json({ ok: true }));
});

it("rechaza una ruta protegida cuando no existe sesión", async () => {
  mocks.session.mockResolvedValue(null);
  const response = await GET(new NextRequest("http://localhost/api/data-science/health"), context("health"));
  expect(response.status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("rechaza un rol autenticado sin autorización", async () => {
  mocks.session.mockResolvedValue({ user: { id: "student", role: "estudiante" } });
  const response = await GET(new NextRequest("http://localhost/api/data-science/health"), context("health"));
  expect(response.status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("permite el acceso a un rol autorizado", async () => {
  mocks.session.mockResolvedValue({ user: { id: "admin", role: "admin" } });
  const response = await GET(new NextRequest("http://localhost/api/data-science/health"), context("health"));
  expect(response.status).toBe(200);
  expect(mocks.fetch).toHaveBeenCalledOnce();
});

it("sustituye userId y role enviados por el cliente con los valores de la sesión", async () => {
  mocks.session.mockResolvedValue({
    user: { id: "researcher-real", role: "docente-investigador" },
  });
  const request = new NextRequest("http://localhost/api/data-science/chat", {
    method: "POST",
    body: JSON.stringify({
      message: "consulta local",
      scope: { userId: "admin-falso", role: "admin", viajeIds: ["viaje-1"] },
    }),
    headers: { "content-type": "application/json" },
  });
  const response = await POST(request, context("chat"));
  expect(response.status).toBe(200);
  const init = mocks.fetch.mock.calls[0]?.[1] as RequestInit;
  const body = JSON.parse(String(init.body));
  expect(body.scope).toEqual({
    userId: "researcher-real",
    role: "docente-investigador",
    viajeIds: ["viaje-1"],
  });
});
