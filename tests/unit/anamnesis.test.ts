import { describe, expect, test } from "vitest";

import { CreateAnamnesisSchema, getAnamnesisSchemaForPatient } from "../../src/lib/schema/anamnesis";
import { firstFieldErrors } from "../../src/lib/schema/field-errors";

function validAnamnesis() {
  return {
    pacienteId: "paciente:1",
    estadoCivil: "Soltero",
    nivelEducativo: "Secundaria concluida",
    motivoConsulta: "Dolor abdominal",
    historiaEnfermedadActual: "Dolor de dos días de evolución.",
    antecedentesNoPatologicos: {
      habitoTabaquico: "Nunca fumo",
      consumoAlcohol: "No consume alcohol",
      realizaActividadFisica: false,
      consumoFrutasVerduras: "1 - 2 porciones al día",
    },
    antecedentesPatologicos: { personales: [], familiares: [] },
  };
}

function gineco() {
  return {
    estadioTanner: "No evaluado",
    gestaciones: 0,
    partos: 0,
    abortos: 0,
    cesareas: 0,
    terapiaAnticonceptiva: false,
  };
}

const patientSchema = getAnamnesisSchemaForPatient("2000-01-01");

describe("anamnesis", () => {
  test("permite antecedentes ginecológicos sin eventos y los omite para otros pacientes", () => {
    expect(patientSchema.safeParse(validAnamnesis()).success).toBe(true);
    expect(patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: gineco() }).success).toBe(true);
  });

  test("rechaza edades imposibles y decimales", () => {
    const result = patientSchema.safeParse({ ...validAnamnesis(), añosCursados: 200, antecedentesGinecoObstetricos: { ...gineco(), menarca: 99 } });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = firstFieldErrors(result.error);
      expect(errors.añosCursados).toContain("edad del paciente");
      expect(errors["antecedentesGinecoObstetricos.menarca"]).toContain("edad del paciente");
    }
    expect(CreateAnamnesisSchema.safeParse({ ...validAnamnesis(), añosCursados: 2.5 }).success).toBe(false);
  });

  test("permite menarca y menopausia inusuales pero posibles", () => {
    const result = patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), menarca: 7, edadMenopausia: 23 } });
    expect(result.success).toBe(true);
  });

  test("valida fechas y conteos relacionados", () => {
    const result = patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), partos: 1, fechaUltimoParto: "2023-02-30" } });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstFieldErrors(result.error)["antecedentesGinecoObstetricos.fechaUltimoParto"]).toContain("fecha válida");
    expect(patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), partos: 1 } }).success).toBe(false);
    expect(patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), fechaUltimaCesarea: "2020-01-01" } }).success).toBe(false);
    expect(patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), gestaciones: 51 } }).success).toBe(false);
    expect(patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), gestaciones: 1, abortos: 2 } }).success).toBe(false);
    expect(patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), fechaPapanicolau: "2999-01-01" } }).success).toBe(false);
  });

  test("exige método anticonceptivo solamente cuando aplica", () => {
    expect(patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), terapiaAnticonceptiva: true } }).success).toBe(false);
    expect(patientSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), terapiaAnticonceptiva: true, metodoAnticonceptivo: "Implante" } }).success).toBe(true);
  });

  test("rechaza antecedentes incompletos y fechas personales anteriores al nacimiento", () => {
    const result = patientSchema.safeParse({ ...validAnamnesis(), antecedentesPatologicos: { personales: [{ enfermedad: { iNo: "", code: "", title: "" }, fechaDiagnostico: "1999-01-01" }], familiares: [{ parentesco: "", enfermedad: { iNo: "", code: "", title: "" }, edadDiagnostico: 200, fallecimiento: true, edadFallecimiento: 5 }] } });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = firstFieldErrors(result.error);
      expect(errors["antecedentesPatologicos.personales.0.enfermedad"]).toBeTruthy();
      expect(errors["antecedentesPatologicos.personales.0.fechaDiagnostico"]).toBeTruthy();
      expect(errors["antecedentesPatologicos.familiares.0.edadDiagnostico"]).toBeTruthy();
    }
  });

  test("conserva el primer error por campo", () => {
    const result = CreateAnamnesisSchema.safeParse({ ...validAnamnesis(), motivoConsulta: " " });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstFieldErrors(result.error).motivoConsulta).toBe("El motivo de consulta es obligatorio.");
    const missingCount = CreateAnamnesisSchema.safeParse({ ...validAnamnesis(), antecedentesGinecoObstetricos: { ...gineco(), gestaciones: Number.NaN } });
    expect(missingCount.success).toBe(false);
    if (!missingCount.success) expect(firstFieldErrors(missingCount.error)["antecedentesGinecoObstetricos.gestaciones"]).toBe("Ingresa un número entero.");
  });
});
