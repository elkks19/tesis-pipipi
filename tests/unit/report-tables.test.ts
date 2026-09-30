import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { measurePdfText, wrapPdfTextToWidth } from "@/lib/reports/simple-pdf";
import { renderInvestigacionReportPdf } from "@/lib/reports/investigacion-report-pdf";

describe("tablas institucionales", () => {
  it("ajusta palabras anchas y textos sin espacios al ancho real de la celda", () => {
    for (const font of ["regular", "bold"] as const) {
      const lines = wrapPdfTextToWidth("WWWWWWWWWWWWWW iii nombre extenso", 40, 9, font);
      expect(lines.every((line) => measurePdfText(line, 9, font) <= 40)).toBe(true);
      expect(lines.join("").replaceAll(" ", "")).toBe("WWWWWWWWWWWWWWiiinombreextenso");
    }
  });

  it("conserva filas y columnas adicionales en tablas que ocupan varias páginas", () => {
    const source = Buffer.from(renderInvestigacionReportPdf({
      answer: "Resumen de prueba.",
      artifacts: [{
        title: "Resultados completos",
        type: "table",
        data: Array.from({ length: 70 }, (_, index) => ({
          identificador: `fila-${index}`,
          descripcion: "Descripción completa de un resultado de investigación",
          total: index,
          grupo: "A",
          porcentaje: "25%",
          columnaAdicional: `dato-adicional-${index}`,
        })),
      }],
    })).toString("latin1");
    expect(source).toContain("fila-69");
    expect(source).toContain("dato-adicional-69");
    expect([...source.matchAll(/\/Type \/Page\b/g)].length).toBeGreaterThan(3);
    expect([...source.matchAll(/\(identificador\) Tj/g)].length).toBeGreaterThan(2);
  });
});
