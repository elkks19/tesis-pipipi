import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), trip: vi.fn(), search: vi.fn() }));
vi.mock("@/lib/auth-session", () => ({ getAuthenticatedUserId: mocks.user }));
vi.mock("@/lib/farmacia", () => ({ getFarmaciaPlanningTrip: mocks.trip }));
vi.mock("@/lib/farmacia-catalogo", () => ({ searchMedicamentoCatalogo: mocks.search }));
import { GET } from "@/app/api/farmacia/catalogo/route";
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue("user"); mocks.trip.mockResolvedValue({ viajeId: "trip" }); mocks.search.mockResolvedValue({ items: [], nextOffset: null }); });
it("requiere sesión y asignación antes de consultar el catálogo", async () => {
  mocks.user.mockResolvedValueOnce(null);
  expect((await GET(new Request("http://localhost/api/farmacia/catalogo?mode=estudiante"))).status).toBe(401);
  mocks.trip.mockResolvedValueOnce(null);
  expect((await GET(new Request("http://localhost/api/farmacia/catalogo?mode=estudiante"))).status).toBe(403);
  expect(mocks.search).not.toHaveBeenCalled();
});
it("rechaza offsets inválidos", async () => {
  expect((await GET(new Request("http://localhost/api/farmacia/catalogo?mode=docente&offset=-1"))).status).toBe(400);
  expect(mocks.search).not.toHaveBeenCalled();
});
it("consulta la página solicitada y no permite caché pública", async () => {
  const response = await GET(new Request("http://localhost/api/farmacia/catalogo?mode=estudiante&q=marca&offset=30"));
  expect(response.status).toBe(200);
  expect(mocks.search).toHaveBeenCalledWith("marca", 30);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
