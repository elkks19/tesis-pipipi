import { describe, expect, test } from "vitest";

import { CreateExamenFisicoGeneralSchema } from "../../src/lib/schema/examenFisicoGeneral";
import { CreateEspirometriaSchema } from "../../src/lib/schema/espirometria";
import { CreateElectrocardiogramaSchema } from "../../src/lib/schema/electrocardiograma";
import { CreateLaboratoriosSchema } from "../../src/lib/schema/laboratorios";

const general = {
  presionArterial: {
    derecha: { max: 120, min: 80 },
    izquierda: { max: 120, min: 80 },
  },
  presionArterialMedia: 93.3,
  pulsos: 80,
  frecuenciaRespiratoria: 16,
  frecuenciaCardiaca: 80,
  temperaturaAxilar: 36.5,
  peso: 70,
  talla: 170,
  imc: 24.22,
  perimetroCadera: 95,
  perimetroCintura: 80,
  indiceCinturaCadera: 0.84,
  diagnosticoIMC: "No tiene desnutrición",
};

describe("validacion de estaciones clinicas", () => {
  test("acepta sistolica de 200, pero rechaza presion invertida y cifras fuera del rango de captura", () => {
    expect(CreateExamenFisicoGeneralSchema.safeParse({
      ...general,
      presionArterial: { ...general.presionArterial, derecha: { max: 200, min: 110 } },
    }).success).toBe(true);

    const inverted = CreateExamenFisicoGeneralSchema.safeParse({
      ...general,
      presionArterial: { ...general.presionArterial, derecha: { max: 80, min: 120 } },
    });
    expect(inverted.success).toBe(false);
    if (!inverted.success) {
      expect(inverted.error.issues[0].path.join(".")).toBe("presionArterial.derecha.max");
    }
    expect(CreateExamenFisicoGeneralSchema.safeParse({ ...general, frecuenciaRespiratoria: 200 }).success).toBe(false);
    expect(CreateExamenFisicoGeneralSchema.safeParse({ ...general, temperaturaAxilar: 0 }).success).toBe(false);
  });

  test("explica en español los datos faltantes del examen general", () => {
    const result = CreateExamenFisicoGeneralSchema.safeParse({
      ...general,
      talla: Number.NaN,
      imc: Number.NaN,
      diagnosticoIMC: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]));
      expect(messages.talla).toBe("Ingresa un valor válido para talla (cm).");
      expect(messages.imc).toBe("Ingresa peso y talla para calcular el IMC.");
      expect(messages.diagnosticoIMC).toBe("Selecciona un diagnóstico IMC.");
    }
  });

  test("valida unidades de espirometria sin confundir relacion con porcentaje teorico", () => {
    const base = { FEV1: 2, porcentajeFEVteorico: 90, FVC: 3, porcentajeFVCteorico: 95,
      FEV1FVC: 0.67, porcentajeFEV1FVCteorico: 85, flujoEspiratorioPicoPEF: 400,
      porcentajePEFteorico: 100, observaciones: [], diagnostico: "Normal" };
    expect(CreateEspirometriaSchema.safeParse(base).success).toBe(true);
    expect(CreateEspirometriaSchema.safeParse({ ...base, FVC: -1 }).success).toBe(false);
    expect(CreateEspirometriaSchema.safeParse({ ...base, porcentajeFVCteorico: 600 }).success).toBe(false);
  });

  test("exige derivacion si se marca desnivel ST", () => {
    const base = { ritmo: "Sinusal", frecuenciaCardiaca: 80, crecimientoAuriculaDerecha: false,
      crecimientoAuriculaIzquierda: false, crecimientoVentriculoDerecho: false,
      crecimientoVentriculoIzquierdo: false, intervaloPR: 160, intervaloQTc: 420,
      supraInfraDesnivelST: true, derivacionSupraInfraDesnivelST: "", duracionOndaP: 100,
      duracionComplejoQRS: 90, duracionOndaT: 150, extrasistoleSupraventricular: false,
      extrasistoleIntraventricular: false, diagnostico: "Sin cambios" };
    expect(CreateElectrocardiogramaSchema.safeParse(base).success).toBe(false);
    expect(CreateElectrocardiogramaSchema.safeParse({ ...base, derivacionSupraInfraDesnivelST: "V2" }).success).toBe(true);
  });

  test("exige resultados en estudios agregados", () => {
    expect(CreateLaboratoriosSchema.safeParse({ glicemiaCapilar: "100 mg/dL", grupoSanguineo: "O+" }).success).toBe(true);
    expect(CreateLaboratoriosSchema.safeParse({ glicemiaCapilar: " ", grupoSanguineo: "O+" }).success).toBe(false);
    expect(CreateLaboratoriosSchema.safeParse({ glicemiaCapilar: "100", grupoSanguineo: "O+", otrosEstudios: [{ nombre: "Hemograma", resultado: "" }] }).success).toBe(false);
  });
});
