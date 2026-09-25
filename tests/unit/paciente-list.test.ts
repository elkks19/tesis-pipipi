import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db-indexes", () => ({ ensureTesisIndexes: vi.fn() }));
vi.mock("@/lib/db-find", () => ({ findTesisDocs: vi.fn() }));

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
  beforeEach(() => vi.clearAllMocks());

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
        limit: 24,
        selector: {
          pacienteId: { $in: ["paciente:1", "paciente:2"] },
          type: "historia",
        },
      }),
    );
  });
});
