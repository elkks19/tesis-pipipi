import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), resolve: vi.fn(), get: vi.fn(), find: vi.fn(), allDocs: vi.fn(), users: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-session", () => ({ getAuthenticatedUser: mocks.user }));
vi.mock("@/lib/student-trip-resolution", () => ({ resolveDocenteTripRoute: mocks.resolve }));
vi.mock("@/lib/db", () => ({ db: { get: mocks.get, allDocs: mocks.allDocs } }));
vi.mock("@/lib/db-find", () => ({ findTesisDocs: mocks.find }));
vi.mock("@/lib/db-indexes", () => ({ ensureTesisIndexes: vi.fn() }));
vi.mock("@/lib/auth-users", () => ({ getAuthUsersByIds: mocks.users }));

import { getDocenteReportData, belongsToReportStation } from "@/lib/reports/docente-report-data";
import { handleStationReport } from "@/app/docente/_lib/station-report-route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "teacher", role: "docente", name: "Docente" });
  mocks.resolve.mockResolvedValue({ activeTrip: { viajeId: "trip", estacionTipo: "Anamnesis", servicio: "Servicio", establecimiento: "Centro" } });
  mocks.get.mockResolvedValue({ type: "viaje", estaciones: [{ tipo: "Anamnesis", docenteEncargadoId: "teacher", estudiantesIds: ["student"] }] });
  mocks.find.mockResolvedValue({ docs: [] });
  mocks.allDocs.mockResolvedValue({ rows: [] });
  mocks.users.mockReturnValue(new Map([["student", { name: "Estudiante" }]]));
});

describe("reportes separados por estación", () => {
  it("incluye autores de otras estaciones y entregas únicamente de la receta de la atención", async () => {
    mocks.users.mockReturnValue(new Map([["diagnostico-user", { name: "Autor de diagnostico" }], ["farmacia-user", { name: "Autor de entrega" }]]));
    mocks.find.mockImplementation(({ selector }) => Promise.resolve({ docs: selector.type === "historia" ? [
      { _id: "h", type: "historia", pacienteId: "p", viajeId: "trip", diagnostico: { created_by: "diagnostico-user", secundarios: [], planTrabajo: "Plan detallado" } },
    ] : selector.type === "receta" ? [
      { _id: "r", id: "r", type: "receta", historiaId: "h", pacienteId: "p", viajeId: "trip", medicamentos: [{ nombre: "Medicamento autorizado", dosis: "Dosis", frecuencia: "Frecuencia", duracion: "Duracion", unidad: "tabletas" }] },
    ] : selector.type === "dispensacionReceta" ? [
      { id: "d", type: "dispensacionReceta", recetaId: "r", viajeId: "trip", createdBy: "farmacia-user", lineas: [{ recetaMedicamentoIndex: 0, cantidad: 7 }] },
      { id: "other", type: "dispensacionReceta", recetaId: "otra-receta", viajeId: "trip", createdBy: "otro-user", lineas: [{ recetaMedicamentoIndex: 0, cantidad: 999 }] },
    ] : [] }));
    const response = await handleStationReport(new Request("http://localhost/report?scope=atencion&id=h&detail=complete"), "anamnesis");
    const pdf = Buffer.from(await response.arrayBuffer()).toString("latin1");
    expect(response.status).toBe(200);
    expect(pdf).toContain("Autor de diagnostico");
    expect(pdf).toContain("Autor de entrega");
    expect(pdf).toContain("7 tabletas");
    expect(pdf).not.toContain("999 tabletas");
    expect(mocks.users).toHaveBeenCalledWith(expect.arrayContaining(["diagnostico-user", "farmacia-user"]));
  });
  it("rechaza usuarios sin sesión y estudiantes antes de leer historias", async () => {
    mocks.user.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "student", role: "estudiante" });
    expect(await getDocenteReportData("anamnesis")).toBeNull();
    expect(await getDocenteReportData("anamnesis")).toBeNull();
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("rechaza otra estación y comprueba la asignación del viaje", async () => {
    expect(await getDocenteReportData("ecografia")).toBeNull();
    mocks.get.mockResolvedValue({ type: "viaje", estaciones: [{ tipo: "Anamnesis", docenteEncargadoId: "other", estudiantesIds: [] }] });
    expect(await getDocenteReportData("anamnesis")).toBeNull();
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("excluye historias de otro viaje y estudios no solicitados", () => {
    const historia = { type: "historia" as const, pacienteId: "patient", viajeId: "trip" };
    expect(belongsToReportStation(historia, "anamnesis", "other")).toBe(false);
    expect(belongsToReportStation(historia, "ecografia", "trip")).toBe(false);
    expect(belongsToReportStation(historia, "anamnesis", "trip")).toBe(true);
  });
  it("rechaza identificadores ajenos aunque se manipule la URL", async () => {
    for (const scope of ["estudiante", "atencion", "paciente"]) {
      const result = await handleStationReport(new Request(`http://localhost/report?scope=${scope}&id=outside`), "anamnesis");
      expect(result.status).toBe(404);
    }
    expect((await handleStationReport(new Request("http://localhost/report?scope=invalid"), "anamnesis")).status).toBe(400);
  });
  it("valida fechas antes de consultar datos", async () => {
    const response = await handleStationReport(new Request("http://localhost/report?scope=global&from=2026-10-01&to=2026-09-01"), "anamnesis");
    expect(response.status).toBe(400);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("el historial por paciente filtra sus visitas y no amplía el acceso al pedir detalle completo", async () => {
    mocks.find.mockImplementation(({ selector }) => Promise.resolve({ docs: selector.type === "historia" ? [
      { _id: "h1", type: "historia", pacienteId: "p", viajeId: "trip", createdAt: "2026-09-29T12:00:00Z", created_by: "student", anamnesis: { motivoConsulta: "CONSULTA INCLUIDA" }, diagnostico: { planTrabajo: "PLAN COMPLETO", secundarios: [] } },
      { _id: "h2", type: "historia", pacienteId: "p", viajeId: "trip", createdAt: "2026-10-29T12:00:00Z", anamnesis: { motivoConsulta: "CONSULTA FUERA DE FECHA" } },
      { _id: "h3", type: "historia", pacienteId: "otro", viajeId: "trip", createdAt: "2026-09-29T12:00:00Z", anamnesis: { motivoConsulta: "PACIENTE AJENO" } },
    ] : [] }));
    const request = new Request("http://localhost/report?scope=paciente&id=p&detail=complete&from=2026-09-29&to=2026-09-29");
    const response = await handleStationReport(request, "anamnesis");
    expect(response.status).toBe(200);
    const source = Buffer.from(await response.arrayBuffer()).toString("latin1");
    expect(source).toContain("CONSULTA INCLUIDA");
    expect(source).toContain("PLAN COMPLETO");
    expect(source).not.toContain("CONSULTA FUERA DE FECHA");
    expect(source).not.toContain("PACIENTE AJENO");
    expect(source).toContain("Historia registrada por: Estudiante");
    const outside = await handleStationReport(new Request("http://localhost/report?scope=atencion&id=h2&from=2026-09-29&to=2026-09-29"), "anamnesis");
    expect(outside.status).toBe(404);
  });
  it("pagina las historias y mantiene visitas separadas del mismo paciente", async () => {
    const histories = Array.from({ length: 201 }, (_, index) => ({ _id: `history-${index}`, type: "historia", pacienteId: "patient", viajeId: "trip", anamnesis: { created_by: "student" } }));
    mocks.find.mockImplementation(({ skip }) => Promise.resolve({ docs: histories.slice(skip, skip + 200) }));
    const result = await getDocenteReportData("anamnesis");
    expect(result?.options.visits).toHaveLength(201);
    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ selector: { type: "historia", viajeId: "trip" } }));
    expect(result?.options.visits[0].author).toBe("Estudiante");
  });
  it("descarga un PDF global privado del alcance autorizado", async () => {
    const response = await handleStationReport(new Request("http://localhost/report?scope=global"), "anamnesis");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });
  it("el PDF de un estudiante excluye atenciones registradas por otros", async () => {
    mocks.find.mockResolvedValue({ docs: [
      { _id: "h-a", type: "historia", pacienteId: "p-a", viajeId: "trip", anamnesis: { created_by: "student" } },
      { _id: "h-b", type: "historia", pacienteId: "p-b", viajeId: "trip", anamnesis: { created_by: "other" } },
    ] });
    mocks.allDocs.mockResolvedValue({ rows: [
      { id: "p-a", doc: { _id: "p-a", type: "paciente", datosPersonales: { nombres: "Paciente incluido", documentoIdentidad: "CI", numeroDocumentoIdentidad: "100" } } },
      { id: "p-b", doc: { _id: "p-b", type: "paciente", datosPersonales: { nombres: "Paciente excluido", documentoIdentidad: "CI", numeroDocumentoIdentidad: "200" } } },
    ] });
    const response = await handleStationReport(new Request("http://localhost/report?scope=estudiante&id=student"), "anamnesis");
    const source = Buffer.from(await response.arrayBuffer()).toString("latin1");
    expect(source).toContain("Paciente incluido");
    expect(source).not.toContain("Paciente excluido");
  });
  it("Farmacia atribuye la atención al dispensador y no al autor de la receta", async () => {
    mocks.resolve.mockResolvedValue({ activeTrip: { viajeId: "trip", estacionTipo: "Farmacia", servicio: "Servicio", establecimiento: "Centro" } });
    mocks.get.mockResolvedValue({ type: "viaje", estaciones: [{ tipo: "Farmacia", docenteEncargadoId: "teacher", estudiantesIds: ["student"] }] });
    mocks.find.mockImplementation(({ selector }) => Promise.resolve({ docs: selector.type === "historia" ? [{ _id: "h", type: "historia", pacienteId: "p", viajeId: "trip" }] : selector.type === "receta" ? [{ _id: "r", id: "r", type: "receta", historiaId: "h", pacienteId: "p", viajeId: "trip", createdBy: "doctor", entregada: true }] : [{ _id: "d", type: "dispensacionReceta", recetaId: "r", createdBy: "student", viajeId: "trip" }] }));
    const result = await getDocenteReportData("farmacia");
    expect(result?.options.visits[0]).toMatchObject({ authorIds: ["student"], author: "Estudiante", completed: true });
  });
});
