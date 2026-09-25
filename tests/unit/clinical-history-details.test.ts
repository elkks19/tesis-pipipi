import { describe, expect, test } from "vitest";
import { getClinicalDetailGroups } from "../../src/lib/clinical-history-details";
import type { Historia } from "../../src/lib/schema/historia";

describe("Detalle de historia clínica", () => {
  test("conserva cero y No, y distingue campos ausentes en registros antiguos", () => {
    const historia = { anamnesis: { añosCursados: 0, antecedentesNoPatologicos: { realizaActividadFisica: false } } } as Historia;
    const fields = getClinicalDetailGroups(historia, "anamnesis").flatMap((g) => g.items);
    expect(fields.find((f) => f.label === "Años cursados")?.value).toBe("0");
    expect(fields.find((f) => f.label === "Actividad física")?.value).toBe("No");
    expect(fields.find((f) => f.label === "Consumo de alcohol")?.value).toBe("Sin registrar");
  });

  test("incluye cada antecedente y los detalles ginecológicos sin exponer metadatos", () => {
    const historia = { anamnesis: {
      created_by: "usuario-privado",
      antecedentesPatologicos: {
        personales: [
          { enfermedad: { title: "Enfermedad A", code: "A1", iNo: "uri-interna" }, fechaDiagnostico: "2025-01-02", tratamiento: "Tratamiento A" },
          { enfermedad: { title: "Enfermedad B", code: "B1" }, tratamiento: "Tratamiento B" },
        ],
        familiares: [{ parentesco: "Madre", enfermedad: { title: "Enfermedad C" }, edadDiagnostico: 40, fallecimiento: true, edadFallecimiento: 75 }],
      },
      antecedentesGinecoObstetricos: { gestaciones: 0, terapiaAnticonceptiva: false, biopsiaCervical: "Resultado completo", fechaPapanicolau: "2025-02-03" },
    } } as unknown as Historia;
    const groups = getClinicalDetailGroups(historia, "anamnesis");
    expect(groups.filter((g) => g.title.startsWith("Antecedente personal"))).toHaveLength(2);
    const content = JSON.stringify(groups);
    for (const value of ["Tratamiento A", "Tratamiento B", "02/01/2025", "75", "Resultado completo", "03/02/2025"]) expect(content).toContain(value);
    expect(content).not.toContain("usuario-privado");
    expect(content).not.toContain("uri-interna");
  });

  test("presenta hallazgos complementarios que el resumen omitía", () => {
    const historia = {
      electrocardiograma: { duracionOndaP: 80, crecimientoAuriculaDerecha: false, derivacionSupraInfraDesnivelST: "V2" },
      ecografia: { riñones: { derecho: { longitud: 101, parenquima: 12 }, izquierdo: { longitud: 102, parenquima: 13 }, diagnostico: "Hallazgo renal" } },
    } as Historia;
    const ecg = getClinicalDetailGroups(historia, "electrocardiograma").flatMap((g) => g.items);
    expect(ecg.find((f) => f.label === "Duración de onda P (ms)")?.value).toBe("80");
    expect(ecg.find((f) => f.label === "Crecimiento de aurícula derecha")?.value).toBe("No");
    const renal = getClinicalDetailGroups(historia, "ecografia").find((g) => g.title === "Riñones");
    expect(renal?.items.find((f) => f.label === "Longitud izquierda (mm)")?.value).toBe("102");
  });
});
