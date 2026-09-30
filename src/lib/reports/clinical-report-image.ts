import "server-only";

import sharp from "sharp";
import { getFileStream } from "@/lib/file-storage";
import type { HistoriaClinicalPdfData } from "./historia-clinica-pdf";

/** Call only after authorizing the history. Never fetch an arbitrary stored URL. */
export async function prepareClinicalReportImage(data: HistoriaClinicalPdfData): Promise<HistoriaClinicalPdfData> {
  const image = data.historia.ecografia?.imagen;
  if (!image) return data;
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (image.data && image.data.length > 28 * 1024 * 1024) throw new Error("Image too large");
    const stream = image.data ? [Buffer.from(image.data, "base64")] : await getFileStream(image.key);
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += bytes.length;
      if (length > 20 * 1024 * 1024) throw new Error("Image too large");
      chunks.push(new Uint8Array(bytes));
    }
    const result = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 })
      .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "white" }).toColourspace("srgb").jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
    return { ...data, ultrasoundImage: { jpeg: new Uint8Array(result.data), width: result.info.width, height: result.info.height } };
  } catch {
    return { ...data, ultrasoundImageError: "No se pudo incorporar el archivo adjunto. Consulta la imagen original en la historia del sistema." };
  }
}
