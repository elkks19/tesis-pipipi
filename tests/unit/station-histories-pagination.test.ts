import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  get: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/db", () => ({ db: { get: mocks.get } }));
vi.mock("../../src/lib/db-find", () => ({ findTesisDocs: mocks.find }));
vi.mock("../../src/lib/db-indexes", () => ({ ensureTesisIndexes: async () => undefined }));

import { listStationHistories } from "../../src/lib/station-histories";

describe("paginación de historias de estación", () => {
  beforeEach(() => {
    mocks.find.mockReset();
    mocks.get.mockReset();

    const histories = Array.from({ length: 30 }, (_, index) => ({
      _id: `historia-${index}`,
      pacienteId: `paciente-${index}`,
      type: "historia",
    }));

    mocks.find.mockResolvedValue({ docs: histories });
    mocks.get.mockImplementation(async (id: string) => ({
      _id: id,
      datosPersonales: {
        apellidoMaterno: "Paz",
        apellidoPaterno: "Rojas",
        documentoIdentidad: "CI",
        fechaNacimiento: "2000-01-01",
        nombres: id,
        numeroDocumentoIdentidad: id,
      },
      genero: "Femenino",
      lugarNacimiento: { departamento: "La Paz", distrito: "La Paz", pais: "Bolivia" },
      nacionalidad: "Boliviana",
      type: "paciente",
    }));
  });

  test("detiene la lectura al completar la página y conserva Siguiente", async () => {
    const page = await listStationHistories({
      includeCompleted: true,
      mode: "estudiante",
      query: "",
      stationKey: "examenFisicoGeneral",
    });

    expect(page.rows).toHaveLength(10);
    expect(page.hasNextPage).toBe(true);
    expect(page.nextCursor).toBe("10");
    expect(mocks.get).toHaveBeenCalledTimes(20);
    expect(mocks.get).not.toHaveBeenCalledWith("paciente-20");

    const secondPage = await listStationHistories({
      cursor: page.nextCursor,
      includeCompleted: true,
      mode: "estudiante",
      query: "",
      stationKey: "examenFisicoGeneral",
    });
    expect(secondPage.rows.map((row) => row.historiaId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `historia-${index + 10}`),
    );
    expect(secondPage.hasNextPage).toBe(true);
  });

  test("solicita las historias recientes antes de paginar", async () => {
    const histories = Array.from({ length: 15 }, (_, index) => ({
      _id: `historia-${index}`,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      pacienteId: `paciente-${index}`,
      type: "historia",
    }));
    mocks.find.mockImplementation(async (request: { sort?: unknown }) => ({
      docs: request.sort ? [...histories].reverse() : histories,
    }));

    const page = await listStationHistories({
      includeCompleted: true,
      mode: "estudiante",
      newestFirst: true,
      query: "",
      stationKey: "examenFisicoGeneral",
    });

    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      sort: [{ type: "desc" }, { createdAt: "desc" }],
      use_index: "idx_historias_fecha",
    }));
    expect(page.rows[0].historiaId).toBe("historia-14");
    expect(page.rows[9].historiaId).toBe("historia-5");
    expect(page.hasNextPage).toBe(true);
  });

  test("conserva las historias antiguas sin fecha al final", async () => {
    const dated = [{ _id: "reciente", createdAt: "2026-09-23T12:00:00.000Z", pacienteId: "paciente-reciente", type: "historia" }];
    const undated = [{ _id: "antigua", pacienteId: "paciente-antigua", type: "historia" }];
    mocks.find.mockImplementation(async (request: { selector: { createdAt?: { $exists: boolean } } }) => ({
      docs: request.selector.createdAt?.$exists === false ? undated : dated,
    }));

    const page = await listStationHistories({
      includeCompleted: true,
      mode: "estudiante",
      newestFirst: true,
      query: "",
      stationKey: "examenFisicoGeneral",
    });

    expect(page.rows.map((row) => row.historiaId)).toEqual(["reciente", "antigua"]);
  });

  test("laboratorios muestra únicamente historias derivadas explícitamente", async () => {
    mocks.find.mockResolvedValue({
      docs: [
        { _id: "derivada", pacienteId: "p-1", type: "historia", examenesComplementariosSolicitados: { laboratorios: true } },
        { _id: "rechazada", pacienteId: "p-2", type: "historia", examenesComplementariosSolicitados: { laboratorios: false } },
        { _id: "texto-falso", pacienteId: "p-3", type: "historia", examenesComplementariosSolicitados: { laboratorios: "false" } },
        { _id: "sin-solicitud", pacienteId: "p-4", type: "historia" },
      ],
    });

    const page = await listStationHistories({
      includeCompleted: true,
      mode: "estudiante",
      query: "",
      stationKey: "laboratorios",
    });

    expect(page.rows.map((row) => row.historiaId)).toEqual(["derivada"]);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  test("electrocardiograma excluye historias sin solicitud explícita", async () => {
    mocks.find.mockResolvedValue({
      docs: [
        { _id: "con-electro", pacienteId: "p-1", type: "historia", examenesComplementariosSolicitados: { electrocardiograma: true } },
        { _id: "sin-electro", pacienteId: "p-2", type: "historia", examenesComplementariosSolicitados: { electrocardiograma: false } },
        { _id: "texto-falso", pacienteId: "p-3", type: "historia", examenesComplementariosSolicitados: { electrocardiograma: "false" } },
        { _id: "sin-derivacion", pacienteId: "p-4", type: "historia" },
      ],
    });

    const page = await listStationHistories({
      includeCompleted: true,
      mode: "estudiante",
      query: "",
      stationKey: "electrocardiograma",
    });

    expect(page.rows.map((row) => row.historiaId)).toEqual(["con-electro"]);
  });

  test("ecografía muestra solo historias con derivación explícita", async () => {
    mocks.find.mockResolvedValue({
      docs: [
        { _id: "con-eco", pacienteId: "p-1", type: "historia", examenesComplementariosSolicitados: { ecografia: true } },
        { _id: "sin-eco", pacienteId: "p-2", type: "historia", examenesComplementariosSolicitados: { ecografia: false } },
        { _id: "sin-solicitud", pacienteId: "p-3", type: "historia" },
      ],
    });

    const page = await listStationHistories({
      includeCompleted: true,
      mode: "estudiante",
      query: "",
      stationKey: "ecografia",
    });

    expect(page.rows.map((row) => row.historiaId)).toEqual(["con-eco"]);
  });

  test("electrocardiograma muestra solo derivaciones del viaje activo asignado", async () => {
    const viaje = {
      _id: "viaje-activo",
      type: "viaje",
      fechaEntrada: "2020-01-01",
      fechaSalida: "2030-12-31",
      estaciones: [{ tipo: "Electrocardiograma", estudiantesIds: ["estudiante-1"] }],
    };
    mocks.find.mockImplementation(async ({ selector }: { selector: { type: string; viajeId?: string } }) => {
      if (selector.type === "viaje") return { docs: [viaje] };
      return {
        docs: selector.viajeId === "viaje-activo"
          ? [{ _id: "derivada-activa", pacienteId: "p-1", viajeId: "viaje-activo", type: "historia", examenesComplementariosSolicitados: { electrocardiograma: true } }]
          : [],
      };
    });
    const getPaciente = mocks.get.getMockImplementation();
    mocks.get.mockImplementation(async (id: string) => id === "viaje-activo" ? viaje : getPaciente?.(id));

    const page = await listStationHistories({
      includeCompleted: true,
      mode: "estudiante",
      query: "",
      stationKey: "electrocardiograma",
      userId: "estudiante-1",
    });

    expect(page.rows.map((row) => row.historiaId)).toEqual(["derivada-activa"]);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      selector: expect.objectContaining({ viajeId: "viaje-activo" }),
    }));
  });
});
