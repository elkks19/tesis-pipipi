import { Readable } from "node:stream";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/file-storage", () => ({ getFileStream: mocks.stream }));
import { prepareClinicalReportImage } from "@/lib/reports/clinical-report-image";
import { renderHistoriaClinicalPdf, type HistoriaClinicalPdfData } from "@/lib/reports/historia-clinica-pdf";

const data: HistoriaClinicalPdfData = {
  generatedAt: "2026-09-29T12:00:00Z", generatedBy: "Docente", paciente: null, receta: null,
  historia: { _id: "h", type: "historia", pacienteId: "p", ecografia: {
    imagen: { key: "ecografia/test.png", nombre: "Ecografia de prueba.png", tipo: "image/png", tamano: 100 },
    higado: { dimensiones: 12, hepatomegalia: false, parenquima: "Homogeneo", diagnostico: "Hallazgo hepático completo" },
    vesiculaBiliar: { paredes: "Regulares", contenidoAnecoico: true, barroBiliar: false, calculos: false, diagnostico: "Hallazgo vesicular completo" },
    riñones: { derecho: { longitud: 10, parenquima: 2 }, izquierdo: { longitud: 11, parenquima: 2 }, ecogenicidad: "Conservada", relacionCorticoMedular: "Conservada", diagnostico: "Hallazgo renal completo" },
  } },
};

describe("imagen de ecografía en el historial", () => {
  it("convierte el archivo privado e incorpora la imagen sin perder los hallazgos", async () => {
    const png = await sharp({ create: { width: 640, height: 320, channels: 3, background: "#606060" } }).png().toBuffer();
    mocks.stream.mockResolvedValueOnce(Readable.from([png]));
    const prepared = await prepareClinicalReportImage(data);
    expect(mocks.stream).toHaveBeenCalledWith("ecografia/test.png");
    expect(prepared.ultrasoundImage?.width).toBe(640);
    const pdf = Buffer.from(renderHistoriaClinicalPdf(prepared)).toString("latin1");
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2);
    expect(pdf).toContain("12 cm");
    expect(pdf).toContain("Hallazgo renal completo");
    const offset = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    expect(pdf.slice(offset, offset + 4)).toBe("xref");
    const embedded = structuredClone(data);
    embedded.historia.ecografia!.imagen!.data = png.toString("base64");
    expect((await prepareClinicalReportImage(embedded)).ultrasoundImage?.height).toBe(320);
  });
  it("indica un archivo faltante y mantiene el resto del reporte", async () => {
    mocks.stream.mockRejectedValueOnce(new Error("missing"));
    const prepared = await prepareClinicalReportImage(data);
    expect(prepared.ultrasoundImageError).toContain("No se pudo incorporar");
    expect(Buffer.from(renderHistoriaClinicalPdf(prepared)).toString("latin1")).toContain("Hallazgo renal completo");
  });
});
