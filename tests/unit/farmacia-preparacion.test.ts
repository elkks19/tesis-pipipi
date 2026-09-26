import { describe, expect, it } from "vitest";
import { canPerformFarmaciaAction, getFarmaciaAccessPhase } from "@/lib/farmacia-access";
import { farmaciaNavigation } from "@/lib/farmacia-navigation";
import { EditarPlaneacionSchema } from "@/lib/schema/farmacia";

describe("cierre de preparación al iniciar el viaje", () => {
  it("cierra exactamente a medianoche de Bolivia", () => {
    const trip = { fechaEntrada: "2026-10-10", fechaSalida: "2026-10-12" };
    expect(getFarmaciaAccessPhase(trip, new Date("2026-10-10T03:59:59Z"))).toBe("planeacion");
    expect(getFarmaciaAccessPhase(trip, new Date("2026-10-10T04:00:00Z"))).toBe("activo");
  });
  it.each(["activo", "conciliacion", "cerrado"] as const)("no permite editar ni recibir al estudiante en %s", (phase) => {
    expect(canPerformFarmaciaAction({ mode: "estudiante", phase, permission: "plan" })).toBe(false);
    expect(canPerformFarmaciaAction({ mode: "estudiante", phase, permission: "receive" })).toBe(false);
    expect(canPerformFarmaciaAction({ mode: "estudiante", phase, permission: "adjust" })).toBe(false);
    const paths = farmaciaNavigation("estudiante", phase).map((item) => item.href);
    expect(paths.some((path) => /entradas|ajustes|planeacion/.test(path))).toBe(false);
  });
  it("permite preparar antes y entregar durante el viaje", () => {
    for (const permission of ["plan", "receive"] as const) expect(canPerformFarmaciaAction({ mode: "estudiante", phase: "planeacion", permission })).toBe(true);
    expect(canPerformFarmaciaAction({ mode: "estudiante", phase: "planeacion", permission: "operate" })).toBe(false);
    expect(canPerformFarmaciaAction({ mode: "estudiante", phase: "activo", permission: "operate" })).toBe(true);
    expect(canPerformFarmaciaAction({ mode: "docente", phase: "activo", permission: "receive" })).toBe(true);
  });
  it("separa entradas y ajustes para el docente", () => {
    const paths = farmaciaNavigation("docente", "activo").map((item) => item.href);
    expect(paths).toContain("/docente/farmacia/entradas");
    expect(paths).toContain("/docente/farmacia/ajustes");
    expect(paths).toContain("/docente/farmacia/recetas");
    expect(paths).toContain("/docente/farmacia/insumos");
  });
});

it("valida cantidades y fechas reales al editar preparación", () => {
  const valid = { cantidadPlanificada: "20", cantidadDisponible: "10", cantidadMinima: "2", unidad: "unidades", lote: "L1", fechaVencimiento: "2027-02-28", observaciones: "" };
  expect(EditarPlaneacionSchema.safeParse(valid).success).toBe(true);
  for (const invalid of [{ cantidadPlanificada: "" }, { cantidadDisponible: "-1" }, { cantidadMinima: "1.2" }, { unidad: "" }, { fechaVencimiento: "2027-02-30" }, { fechaVencimiento: "2027-99-10" }]) expect(EditarPlaneacionSchema.safeParse({ ...valid, ...invalid }).success).toBe(false);
});
