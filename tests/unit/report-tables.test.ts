import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { measurePdfText, wrapPdfTextToWidth } from "@/lib/reports/simple-pdf";
import {
  renderInvestigacionReportPdf,
  type InvestigacionReport,
} from "@/lib/reports/investigacion-report-pdf";

function makeReport(
  artifacts: InvestigacionReport["artifacts"],
): InvestigacionReport {
  return {
    answer: "Resumen de prueba.",
    artifacts,
    generatedAt: new Date("2026-09-30T12:00:00-04:00"),
    question: "¿Qué muestran los datos?",
    requestedBy: "Investigador de prueba",
    requestedRole: "docente-investigador",
    scopeLabel: "Todos los viajes · Todas las estaciones",
    sources: [],
    title: "Reporte de prueba",
  };
}

describe("tablas institucionales", () => {
  it("ajusta palabras anchas y textos sin espacios al ancho real de la celda", () => {
    for (const font of ["regular", "bold"] as const) {
      const lines = wrapPdfTextToWidth("WWWWWWWWWWWWWW iii nombre extenso", 40, 9, font);
      expect(lines.every((line) => measurePdfText(line, 9, font) <= 40)).toBe(true);
      expect(lines.join("").replaceAll(" ", "")).toBe("WWWWWWWWWWWWWWiiinombreextenso");
    }
  });

  it("conserva filas y columnas adicionales en tablas que ocupan varias páginas", async () => {
    const source = Buffer.from(await renderInvestigacionReportPdf(makeReport([{
      title: "Resultados completos",
      type: "table",
      data: Array.from({ length: 70 }, (_, index) => ({
        identificador: "fila-" + index,
        descripcion: "Descripción completa de un resultado de investigación",
        total: index,
        grupo: "A",
        porcentaje: "25%",
        columnaAdicional: "dato-adicional-" + index,
      })),
    }]))).toString("latin1");

    expect(source).toContain("fila-69");
    expect(source).toContain("dato-adicional-69");
    expect([...source.matchAll(/\/Type \/Page\b/g)].length).toBeGreaterThan(3);
    expect([...source.matchAll(/\(identificador\) Tj/g)].length).toBeGreaterThan(2);
  });

  it.each(["bar", "line", "pie", "scatter", "heatmap"])(
    "inserta una imagen local para el gráfico %s y conserva su tabla",
    async (kind) => {
      const source = Buffer.from(
        await renderInvestigacionReportPdf(
          makeReport([
            {
              data: [
                { categoria: "A", grupo: "Mujeres", total: 8 },
                { categoria: "B", grupo: "Hombres", total: 5 },
                { categoria: "C", grupo: "Mujeres", total: 3 },
              ],
              spec: {
                group: "grupo",
                kind,
                x: "categoria",
                y: "total",
              },
              title: "Gráfico " + kind,
              type: "chart",
            },
          ]),
        ),
      ).toString("latin1");

      expect(source).toContain("/Subtype /Image");
      expect(source).toContain("(categoria) Tj");
      expect(source).toContain("(Mujeres) Tj");
    },
  );
});
