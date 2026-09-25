import { describe, expect, it } from "vitest";

import {
  getHistoriaClinicalPdfFileName,
  renderHistoriaClinicalPdf,
  type HistoriaClinicalPdfData,
} from "@/lib/reports/historia-clinica-pdf";

const reportData: HistoriaClinicalPdfData = {
  generatedAt: "2026-09-22T20:00:00.000Z",
  generatedBy: "Ana Anamnesis",
  historia: {
    _id: "historia:paciente:demo:1",
    type: "historia",
    createdAt: "2026-09-20T14:30:00.000Z",
    pacienteId: "paciente:demo",
    anamnesis: {
      antecedentesNoPatologicos: {
        consumoAlcohol: "No consume alcohol",
        consumoFrutasVerduras: "3 - 4 porciones al día",
        habitoTabaquico: "Nunca fumo",
        realizaActividadFisica: true,
      },
      antecedentesPatologicos: {
        familiares: [],
        personales: [],
      },
      estadoCivil: "Soltero",
      historiaEnfermedadActual:
        "Dolor epigástrico de tres meses de evolución posterior a las comidas.",
      motivoConsulta: "Dolor epigástrico y acidez",
      nivelEducativo: "Secundaria concluida",
    },
    diagnostico: {
      planTrabajo: "Tratamiento y control clínico en cuatro semanas.",
      principal: {
        code: "DA42",
        iNo: "123456",
        title: "Gastritis",
      },
      secundarios: [],
    },
  },
  paciente: {
    _id: "paciente:demo",
    type: "paciente",
    createdAt: "2026-09-01T13:15:00.000Z",
    updatedAt: "2026-09-10T16:45:00.000Z",
    datosPersonales: {
      apellidoMaterno: "Paco",
      apellidoPaterno: "Blanmco",
      documentoIdentidad: "CI",
      fechaNacimiento: new Date("2001-09-17T00:00:00.000Z"),
      nombres: "Noah",
      numeroDocumentoIdentidad: "8308424",
    },
    genero: "Femenino",
    lugarNacimiento: {
      departamento: "La Paz",
      pais: "Bolivia",
    },
    nacionalidad: "Boliviana",
  },
  receta: null,
};

describe("historia clínica PDF", () => {
  it("genera un PDF interno con las secciones clínicas", () => {
    const pdf = Buffer.from(renderHistoriaClinicalPdf(reportData));
    const source = pdf.toString("latin1");

    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect(source).toContain("HISTORIA CLÍNICA");
    expect(source).toContain("FECHA DE ATENCIÓN");
    expect(source).toContain("DIAGNÓSTICO PRINCIPAL");
    expect(source).toContain("Datos del paciente");
    expect(source).toContain("Fecha de registro");
    expect(source).toContain("Anamnesis");
    expect(source).toContain("Diagnóstico y plan");
    expect(source.endsWith("%%EOF")).toBe(true);
  });

  it("crea un nombre de archivo estable con paciente y fecha", () => {
    expect(getHistoriaClinicalPdfFileName(reportData)).toBe(
      "historia-clinica-8308424-noah-blanmco-paco-2026-09-20.pdf",
    );
  });
});
