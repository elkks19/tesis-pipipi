import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db-indexes", () => ({ ensureTesisIndexes: vi.fn() }));
vi.mock("@/lib/db-find", () => ({ findTesisDocs: vi.fn() }));
vi.mock("@/lib/auth-users", () => ({ getAuthUsersByIds: vi.fn(() => new Map()) }));

import { getAuthUsersByIds } from "../../src/lib/auth-users";
import { findTesisDocs } from "../../src/lib/db-find";
import {
  getHistoriasByPacienteIds,
  searchPacientes,
} from "../../src/app/estudiante/anamnesis/create-historia/queries";

function paciente(index: number) {
  return {
    _id: `paciente:${index}`, _rev: "1-test", type: "paciente",
    datosPersonales: { nombres: "José", fechaNacimiento: "2000-01-01" },
    lugarNacimiento: {}, genero: "Masculino", nacionalidad: "Boliviana", etnia: "",
  };
}

describe("Listado paginado de pacientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthUsersByIds).mockReturnValue(new Map());
  });

  test("carga el listado inicial y reserva el registro extra para detectar otra página", async () => {
    vi.mocked(findTesisDocs).mockResolvedValue({ docs: Array.from({ length: 21 }, (_, i) => paciente(i)) } as never);
    const result = await searchPacientes("");
    expect(result.pacientes).toHaveLength(20);
    expect(result.hasNext).toBe(true);
    expect(findTesisDocs).toHaveBeenCalledWith(expect.objectContaining({ limit: 21, skip: 0, selector: { type: "paciente" } }));
  });

  test("consulta la siguiente página sin cargar los registros anteriores", async () => {
    vi.mocked(findTesisDocs).mockResolvedValue({ docs: [paciente(20)] } as never);
    const result = await searchPacientes("", 2);
    expect(result.hasNext).toBe(false);
    expect(result.page).toBe(2);
    expect(findTesisDocs).toHaveBeenCalledWith(expect.objectContaining({ skip: 20 }));
  });

  test("normaliza páginas inválidas y busca cada término antes de paginar", async () => {
    vi.mocked(findTesisDocs).mockResolvedValue({ docs: [] });
    const result = await searchPacientes("José Pérez", NaN);
    expect(result.page).toBe(1);
    const request = vi.mocked(findTesisDocs).mock.calls[0][0];
    expect(request.selector.$and).toHaveLength(2);
    expect(JSON.stringify(request.selector)).toContain("(?i)j[oóòöô]s[eéèëê]");
    expect(result.hasNext).toBe(false);
  });

  test("agrupa las historias de los pacientes visibles para el resumen clínico", async () => {
    vi.mocked(findTesisDocs).mockResolvedValue({
      docs: [
        { _id: "historia:1", _rev: "1-test", type: "historia", pacienteId: "paciente:1" },
        { _id: "historia:2", _rev: "1-test", type: "historia", pacienteId: "paciente:2" },
      ],
    } as never);

    const result = await getHistoriasByPacienteIds([
      "paciente:1",
      "paciente:2",
      "paciente:1",
    ]);

    expect(result["paciente:1"]).toHaveLength(1);
    expect(result["paciente:2"]).toHaveLength(1);
    expect(findTesisDocs).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100,
        selector: {
          pacienteId: { $in: ["paciente:1", "paciente:2"] },
          type: "historia",
        },
      }),
    );
  });
  test("cada visita conserva su estudiante original aunque el paciente regrese o el docente edite", async () => {
    vi.mocked(findTesisDocs).mockResolvedValue({ docs: [
      { _id: "enero", _rev: "1", type: "historia", pacienteId: "p-1", created_by: "ana", createdAt: "2026-01-01", anamnesis: { created_by: "otro", updated_by: "docente" } },
      { _id: "febrero", _rev: "1", type: "historia", pacienteId: "p-1", created_by: "luis", createdAt: "2026-02-01" },
      { _id: "anterior", _rev: "1", type: "historia", pacienteId: "p-1", anamnesis: { created_by: "ana", updated_by: "docente" } },
      { _id: "sin-autor", _rev: "1", type: "historia", pacienteId: "p-1", anamnesis: { updated_by: "docente" } },
    ] } as never);
    vi.mocked(getAuthUsersByIds).mockReturnValue(new Map([
      ["ana", { id: "ana", name: "Ana", email: "ana@example.test", role: "estudiante" }],
      ["luis", { id: "luis", name: "Luis", email: "luis@example.test", role: "estudiante" }],
    ]));
    const result = await getHistoriasByPacienteIds(["p-1"]);
    expect(result["p-1"].map((historia) => historia.registeredBy?.name)).toEqual(["Ana", "Luis", "Ana", undefined]);
    expect(result["p-1"][0].registeredBy).toEqual({ name: "Ana", email: "ana@example.test", role: "estudiante" });
    expect(getAuthUsersByIds).not.toHaveBeenCalledWith(expect.arrayContaining(["docente", "otro"]));
  });

  test("recupera todas las historias sin truncar a 12 ni perder otros pacientes", async () => {
    const histories = Array.from({ length: 103 }, (_, index) => ({
      _id: `historia:${index}`, _rev: "1-test", type: "historia",
      pacienteId: index < 102 ? "paciente:1" : "paciente:2",
    }));
    vi.mocked(findTesisDocs).mockImplementation(async ({ skip = 0, limit = 100 }) => ({ docs: histories.slice(skip, skip + limit) }) as never);
    const result = await getHistoriasByPacienteIds(["paciente:1", "paciente:2"]);
    expect(result["paciente:1"]).toHaveLength(102);
    expect(result["paciente:2"]).toHaveLength(1);
    expect(new Set(result["paciente:1"].map((history) => history._id)).size).toBe(102);
    expect(findTesisDocs).toHaveBeenCalledTimes(2);
  });
});
