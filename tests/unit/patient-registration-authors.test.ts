import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), users: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/db-find", () => ({ findTesisDocs: mocks.find }));
vi.mock("../../src/lib/db-indexes", () => ({ ensureTesisIndexes: async () => undefined }));
vi.mock("../../src/lib/auth-users", () => ({ getAuthUsersByIds: mocks.users }));

import { getPatientRegistrationAuthors } from "../../src/lib/pacientes/registration-queries";

describe("responsable del registro del paciente", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  test("no consulta pacientes fuera de la lista y conserva el primer registro", async () => {
    mocks.find.mockResolvedValue({ docs: [
      { pacienteId: "p-1", actorId: "posterior", createdAt: "2026-02-01" },
      { pacienteId: "p-1", actorId: "original", createdAt: "2025-01-01" },
      { pacienteId: "p-2", actorId: "eliminado", createdAt: "2025-01-01" },
    ] });
    mocks.users.mockReturnValue(new Map([["original", { name: "Ana", role: "estudiante", email: "ana@example.test", id: "privado" }]]));
    const authors = await getPatientRegistrationAuthors(["p-1", "p-2", "p-3", "p-1"]);
    expect(authors.get("p-1")).toEqual({ name: "Ana", role: "estudiante", email: "ana@example.test" });
    expect(authors.get("p-2")).toEqual({ name: "Usuario no encontrado" });
    expect(authors.has("p-3")).toBe(false);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ selector: {
      type: "actividad", subject: "paciente", action: "created", pacienteId: { $in: ["p-1", "p-2", "p-3"] },
    } }));
    expect(mocks.users).toHaveBeenCalledWith(["original", "eliminado"]);
  });

  test("una lista vacía no consulta actividad ni usuarios", async () => {
    expect((await getPatientRegistrationAuthors([])).size).toBe(0);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.users).not.toHaveBeenCalled();
  });
});
