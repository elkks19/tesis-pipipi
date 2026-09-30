import { describe, expect, it } from "vitest";

import {
  getHistoriaClinicalPdfFileName,
  renderHistoriaClinicalPdf,
  renderStationClinicalPdf,
  renderPatientStationClinicalPdf,
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
  it("conserva datos de responsables, autores de estaciones y entregas de farmacia", () => {
    const data = structuredClone(reportData);
    data.paciente!.padres = [{ datosPersonales: { ...data.paciente!.datosPersonales, nombres: "Responsable de prueba", numeroDocumentoIdentidad: "DOC-RESP-001" }, relacion: "Madre", asumeSustento: false, numeroContacto: "77712345" }];
    data.historia.anamnesis!.created_by = "anamnesis-author";
    data.historia.diagnostico!.created_by = "diagnosis-author";
    data.historia.diagnostico!.updated_by = "editor";
    data.userNames = { "anamnesis-author": "Ana estudiante", "diagnosis-author": "Luis estudiante", editor: "Docente editor", dispenser: "Estudiante farmacia" };
    data.receta = { id: "r", type: "receta", historiaId: data.historia._id, pacienteId: "paciente:demo", createdAt: "2026-09-20T14:30:00Z", updatedAt: "2026-09-21T14:30:00Z", createdBy: "diagnosis-author", entregada: false, medicamentos: [{ nombre: "Medicamento de prueba", principioActivo: "Principio de prueba", dosis: "Una tableta", frecuencia: "Cada ocho horas", duracion: "Cinco días", viaAdministracion: "Oral", cantidad: 15, unidad: "tabletas", indicaciones: "Indicación completa del medicamento" }] };
    data.deliveries = [{ id: "d", type: "dispensacionReceta", createdAt: "2026-09-21T14:30:00Z", createdBy: "dispenser", recetaId: "r", viajeId: "trip", lineas: [{ inventarioItemId: "i", recetaMedicamentoIndex: 0, cantidad: 5 }] }];
    const source = Buffer.from(renderHistoriaClinicalPdf(data)).toString("latin1");
    const text = [...source.matchAll(/\(([^\n]*)\) Tj ET/g)].map((match) => match[1]).join(" ");
    for (const expected of ["DOC-RESP-001", "17 sept de 2001", "Ana estudiante", "Luis estudiante", "Docente editor", "Estudiante farmacia", "5 tabletas", "Indicación completa del medicamento"]) expect(text).toContain(expected);
    const station = Buffer.from(renderStationClinicalPdf(data, "anamnesis", "Anamnesis", "Ana estudiante")).toString("latin1");
    expect(station).not.toContain("Estudiante farmacia");
  });
  it("une visitas de un paciente en orden con autor y contenido completo opcional", () => {
    const later = structuredClone(reportData);
    later.historia.createdAt = "2026-10-20T12:00:00Z";
    const entries = [{ data: later, registeredBy: "Autor posterior" }, { data: reportData, registeredBy: "Autor original" }];
    const full = Buffer.from(renderPatientStationClinicalPdf(entries, "anamnesis", "Anamnesis", "Todas las fechas disponibles", true)).toString("latin1");
    expect(full.indexOf("Autor original")).toBeLessThan(full.indexOf("Autor posterior"));
    expect(full).toContain("Gastritis");
    expect(full).toContain("HISTORIAL CLÍNICO COMPLETO");
    const station = Buffer.from(renderPatientStationClinicalPdf(entries, "anamnesis", "Anamnesis", "Todas las fechas disponibles")).toString("latin1");
    expect(station).not.toContain("Gastritis");
    expect(station).toContain("Autor posterior");
  });
  it("el reporte por estación no incluye otras secciones clínicas", () => {
    const source = Buffer.from(renderStationClinicalPdf(reportData, "anamnesis", "Anamnesis", "Estudiante original")).toString("latin1");
    expect(source).toContain("Estudiante original");
    expect(source).toContain("Motivo de consulta");
    expect(source).not.toContain("Gastritis");
    expect(source).not.toContain("Diagnóstico y plan");
  });
  it("genera un PDF interno con las secciones clínicas", () => {
    const pdf = Buffer.from(renderHistoriaClinicalPdf(reportData));
    const source = pdf.toString("latin1");

    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect(source).toContain("HISTORIA CLÍNICA");
    expect(source).toContain("Fecha de atención");
    expect(source).toContain("UNIVERSIDAD PRIVADA FRANZ TAMAYO");
    expect(source).toContain("/Subtype /Image");
    expect(source).toContain("/Times-Roman");
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

  it("conserva texto extenso, repite el encabezado y comparte una sola imagen entre páginas", () => {
    const data = structuredClone(reportData);
    data.historia.anamnesis!.historiaEnfermedadActual = `${"Evolución clínica documentada. ".repeat(600)}Fin de la evolución.`;
    const source = Buffer.from(renderHistoriaClinicalPdf(data)).toString("latin1");
    const pageCount = [...source.matchAll(/\/Type \/Page\b/g)].length;
    expect(pageCount).toBeGreaterThan(2);
    const renderedText = [...source.matchAll(/\(([^\n]*)\) Tj ET/g)].map((match) => match[1]).join(" ");
    expect(renderedText).toContain("Fin de la evolución.");
    expect(source.match(/UNIVERSIDAD PRIVADA FRANZ TAMAYO/g)).toHaveLength(pageCount);
    expect(source.match(/\/Subtype \/Image/g)).toHaveLength(1);
    expect(source).toContain(`Página ${pageCount} de ${pageCount}`);
    const xrefOffset = Number(source.match(/startxref\n(\d+)/)?.[1]);
    expect(source.slice(xrefOffset, xrefOffset + 4)).toBe("xref");
  });
});
