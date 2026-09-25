import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  getPaciente: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../src/app/estudiante/anamnesis/create-historia/queries", () => ({
  getPacienteById: mocks.getPaciente,
}));
vi.mock("../../src/lib/db-find", () => ({ findTesisDocs: mocks.find }));
vi.mock("../../src/lib/db-indexes", () => ({ ensureTesisIndexes: async () => undefined }));
vi.mock("../../src/components/historias/historia-clinical-summary", () => ({
  HistoriaClinicalSummaryModal: () => null,
}));

import { getHistoriaClinicalSummaryData } from "../../src/components/historias/historia-clinical-summary-server";

describe("historial clínico del paciente", () => {
  beforeEach(() => {
    mocks.find.mockReset();
    mocks.getPaciente.mockReset();
    mocks.getPaciente.mockResolvedValue(null);
  });

  test("recupera y ordena atenciones previas aunque estén en otra página de la consulta", async () => {
    const firstBatch = Array.from({ length: 50 }, (_, index) => ({
      _id: `anterior-${index}`,
      createdAt: `2025-01-${String(index % 28 + 1).padStart(2, "0")}T12:00:00.000Z`,
      pacienteId: "paciente-1",
      type: "historia",
    }));
    const secondBatch = [
      { _id: "actual", createdAt: "2026-09-24T12:00:00.000Z", pacienteId: "paciente-1", type: "historia" },
      { _id: "anterior-reciente", createdAt: "2026-09-23T12:00:00.000Z", pacienteId: "paciente-1", type: "historia" },
      { _id: "futura", createdAt: "2026-09-25T12:00:00.000Z", pacienteId: "paciente-1", type: "historia" },
    ];
    mocks.find.mockImplementation(async ({ bookmark }: { bookmark?: string }) =>
      bookmark ? { docs: secondBatch } : { bookmark: "segunda", docs: firstBatch },
    );

    const result = await getHistoriaClinicalSummaryData(secondBatch[0] as never);

    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      selector: { pacienteId: "paciente-1", type: "historia" },
    }));
    expect(result.previousHistorias).toHaveLength(12);
    expect(result.previousHistorias[0]._id).toBe("anterior-reciente");
    expect(result.previousHistorias.map((historia) => historia._id)).not.toContain("futura");
    expect(result.previousHistorias.map((historia) => historia._id)).not.toContain("actual");
  });
});
