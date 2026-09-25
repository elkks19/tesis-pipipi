import { describe, expect, it } from "vitest";

import { canPerformFarmaciaAction, getFarmaciaAccessPhase } from "@/lib/farmacia-access";
import { AjustarInventarioSchema, CreateViajeInventarioItemSchema, DispensarRecetaSchema } from "@/lib/schema/farmacia";

const trip = { fechaEntrada: "2026-10-10", fechaSalida: "2026-10-12" };

describe("acceso temporal de farmacia", () => {
  it.each([
    ["2026-10-02T16:00:00Z", "sin_acceso"],
    ["2026-10-03T16:00:00Z", "planeacion"],
    ["2026-10-10T16:00:00Z", "activo"],
    ["2026-10-13T16:00:00Z", "conciliacion"],
    ["2026-10-14T16:00:00Z", "cerrado"],
  ])("resuelve %s como %s", (date, phase) => {
    expect(getFarmaciaAccessPhase(trip, new Date(date))).toBe(phase);
  });

  it("permite planificar a estudiantes y docentes durante la semana previa", () => {
    expect(canPerformFarmaciaAction({ mode: "docente", permission: "plan", phase: "planeacion" })).toBe(true);
    expect(canPerformFarmaciaAction({ mode: "estudiante", permission: "plan", phase: "planeacion" })).toBe(true);
  });

  it("reserva los ajustes activos y la conciliacion para el docente", () => {
    expect(canPerformFarmaciaAction({ mode: "docente", permission: "adjust", phase: "activo" })).toBe(true);
    expect(canPerformFarmaciaAction({ mode: "estudiante", permission: "adjust", phase: "activo" })).toBe(false);
    expect(canPerformFarmaciaAction({ mode: "docente", permission: "adjust", phase: "conciliacion" })).toBe(true);
    expect(canPerformFarmaciaAction({ mode: "estudiante", permission: "adjust", phase: "conciliacion" })).toBe(false);
  });
});

describe("validacion de inventario y dispensacion", () => {
  const baseItem = {
    cantidadMinima: 2,
    cantidadPlanificada: 10,
    categoria: "medicamento",
    concentracion: "500 mg",
    condicion: "disponible",
    formaFarmaceutica: "Comprimido",
    nombre: "Paracetamol",
    principioActivo: "Paracetamol",
    unidad: "tabletas",
  };

  it("exige catalogo para medicamentos AGEMED", () => {
    expect(CreateViajeInventarioItemSchema.safeParse({ ...baseItem, fuente: "agemed" }).success).toBe(false);
    expect(CreateViajeInventarioItemSchema.safeParse({ ...baseItem, catalogoId: "medicamentoCatalogo:agemed:1", fuente: "agemed" }).success).toBe(true);
  });

  it("exige motivo para medicamentos manuales", () => {
    expect(CreateViajeInventarioItemSchema.safeParse({ ...baseItem, fuente: "manual" }).success).toBe(false);
    expect(CreateViajeInventarioItemSchema.safeParse({ ...baseItem, fuente: "manual", manualMotivo: "No figura en el listado" }).success).toBe(true);
  });

  it("rechaza cantidades de dispensacion y ajustes invalidos", () => {
    expect(DispensarRecetaSchema.safeParse({ lineas: [{ cantidad: 0, inventarioItemId: "item", recetaMedicamentoIndex: 0 }] }).success).toBe(false);
    expect(AjustarInventarioSchema.safeParse({ cantidadObjetivo: 3, condicion: "disponible", motivo: "" }).success).toBe(false);
    expect(AjustarInventarioSchema.safeParse({ cantidadObjetivo: 3, condicion: "disponible", motivo: "Conteo fisico", tipo: "ajuste" }).success).toBe(true);
  });
});
