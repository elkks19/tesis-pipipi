import institutionalLogo from "./institutional-logo.json";
import fontMetrics from "./times-font-metrics.json";

export const SIMPLE_PDF_PAGE_WIDTH = 595;
export const SIMPLE_PDF_PAGE_HEIGHT = 842;

const DEFAULT_TEXT_COLOR = "0.09 0.11 0.14";

export type SimplePdfPage = {
  lines: string[];
  images?: PdfImage[];
};

export type PdfImage = { jpeg: Uint8Array; width: number; height: number };

export function addPdfImage(page: SimplePdfPage, image: PdfImage, x: number, y: number, width: number, height: number) {
  page.images ??= [];
  page.images.push(image);
  page.lines.push(`q ${width} 0 0 ${height} ${x} ${y} cm /Image${page.images.length} Do Q`);
}

export function sanitizePdfText(value: string | number | undefined) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "-");
}

function escapePdfText(value: string | number | undefined) {
  return sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function addPdfText(
  page: SimplePdfPage,
  text: string | number,
  x: number,
  y: number,
  size = 10,
  color = DEFAULT_TEXT_COLOR,
  font: "regular" | "bold" = "regular",
) {
  const fontKey = font === "bold" ? "F2" : "F1";

  page.lines.push(`${color} rg`);
  page.lines.push(
    `BT /${fontKey} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`,
  );
}

export function addPdfRect(
  page: SimplePdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  page.lines.push(`${color} rg`);
  page.lines.push(`${x} ${y} ${width} ${height} re f`);
}

export function createSimplePdfPage(): SimplePdfPage {
  return { lines: [] };
}

/** Institutional stationery shared only by the application's own PDF reports. */
export function addInstitutionalHeader(page: SimplePdfPage, title: string) {
  page.lines.push(`q 48 0 0 ${48 * institutionalLogo.height / institutionalLogo.width} 505 777 cm /Logo Do Q`);
  addCenteredPdfText(page, "UNIVERSIDAD PRIVADA FRANZ TAMAYO", 793, 10);
  addCenteredPdfText(page, "CARRERA DE MEDICINA", 777, 9);
  const lines = wrapPdfTextToWidth(title.toUpperCase(), 511, 12, "bold");
  lines.forEach((line, index) => {
    // Reserve a full line for long station names instead of overlapping metadata.
    addCenteredPdfText(page, line, 753 - index * 15, 12, "bold");
  });
  return 730 - (lines.length - 1) * 15;
}

export function measurePdfText(text: string, size = 10, font: "regular" | "bold" = "regular") {
  return [...sanitizePdfText(text)].reduce((width, char) => width + (fontMetrics[font][char.charCodeAt(0)] ?? 500), 0) * size / 1000;
}

export function addCenteredPdfText(page: SimplePdfPage, text: string, y: number, size = 10, font: "regular" | "bold" = "regular") {
  addPdfText(page, text, (595 - measurePdfText(text, size, font)) / 2, y, size, "0 0 0", font);
}

export function wrapPdfTextToWidth(text: string, width: number, size = 9, font: "regular" | "bold" = "regular") {
  const lines: string[] = [];
  for (const paragraph of sanitizePdfText(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && measurePdfText(`${line} ${word}`, size, font) > width) {
        lines.push(line);
        line = "";
      }
      for (const char of (line ? " " : "") + word) {
        if (line && measurePdfText(line + char, size, font) > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draw a bordered row from already wrapped cells; y is its top edge. */
export function addPdfTableRow(page: SimplePdfPage, cells: string[][], widths: number[], y: number, options: { header?: boolean; labelColumn?: boolean; size?: number } = {}) {
  const size = options.size ?? 9;
  const lineHeight = size + 3;
  const height = Math.max(1, ...cells.map((cell) => cell.length)) * lineHeight + 12;
  let x = 42;
  cells.forEach((lines, column) => {
    const bold = options.header || (options.labelColumn && column === 0);
    if (bold) addPdfRect(page, x, y - height, widths[column], height, options.header ? "0.83 0.83 0.83" : "0.96 0.96 0.96");
    addPdfBorder(page, x, y - height, widths[column], height);
    lines.forEach((line, index) => addPdfText(page, line, x + 7, y - 7 - size - index * lineHeight, size, "0.08 0.08 0.08", bold ? "bold" : "regular"));
    x += widths[column];
  });
  return y - height;
}

export function addPaginatedPdfTable(
  headers: string[], widths: number[], rows: string[][],
  startPage: () => { page: SimplePdfPage; y: number },
) {
  const headerCells = headers.map((text, index) => wrapPdfTextToWidth(text, widths[index] - 14, 8, "bold"));
  const nextPage = () => {
    const result = startPage();
    return { page: result.page, y: addPdfTableRow(result.page, headerCells, widths, result.y, { header: true, size: 8 }) };
  };
  let current = nextPage();
  const freshCapacity = current.y - 60;
  for (const row of rows) {
    const cells = headers.map((_, index) => wrapPdfTextToWidth(row[index] ?? "", widths[index] - 14));
    const count = Math.max(...cells.map((cell) => cell.length));
    const height = count * 12 + 12;
    if (height <= freshCapacity && current.y - height < 60) current = nextPage();
    let offset = 0;
    while (offset < count) {
      if (current.y < 84) current = nextPage();
      const capacity = Math.max(1, Math.floor((current.y - 60 - 12) / 12));
      const length = Math.min(capacity, count - offset);
      current.y = addPdfTableRow(current.page, cells.map((cell) => cell.slice(offset, offset + length)), widths, current.y);
      offset += length;
      if (offset < count) current = nextPage();
    }
  }
}

export function addPdfBorder(page: SimplePdfPage, x: number, y: number, width: number, height: number) {
  page.lines.push(`q 0.45 G 0.5 w ${x} ${y} ${width} ${height} re S Q`);
}

export function wrapPdfText(value: string, maxCharacters = 88) {
  const paragraphs = sanitizePdfText(value).split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let current = "";

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    for (const word of words) {
      if (word.length > maxCharacters) {
        if (current) {
          lines.push(current);
          current = "";
        }

        for (let index = 0; index < word.length; index += maxCharacters) {
          lines.push(word.slice(index, index + maxCharacters));
        }
      } else if (`${current} ${word}`.trim().length > maxCharacters) {
        lines.push(current);
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines.length > 0 ? lines : [""];
}

export function buildSimplePdf(pages: SimplePdfPage[]) {
  const logoId = 3 + pages.length * 2;
  let imageId = logoId + 1;
  const pageImages = pages.map((page) => (page.images ?? []).map((image, index) => ({ image, name: `Image${index + 1}`, id: imageId++ })));
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((page, index) => {
    const contentObjectId = 4 + index * 2;
    const footer = createSimplePdfPage();
    addPdfText(footer, "UNIFRANZ - Carrera de Medicina", 42, 28, 8, "0.3 0.3 0.3");
    addPdfText(footer, `Página ${index + 1} de ${pages.length}`, 484, 28, 8, "0.3 0.3 0.3");
    const stream = [...page.lines, ...footer.lines].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${SIMPLE_PDF_PAGE_WIDTH} ${SIMPLE_PDF_PAGE_HEIGHT}] /Resources << /XObject << /Logo ${logoId} 0 R ${pageImages[index].map((item) => `/${item.name} ${item.id} 0 R`).join(" ")} >> /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >> >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
  });

  const logo = Buffer.from(institutionalLogo.base64, "base64");
  objects.push(`<< /Type /XObject /Subtype /Image /Width ${institutionalLogo.width} /Height ${institutionalLogo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n${logo.toString("latin1")}\nendstream`);
  for (const { image } of pageImages.flat()) {
    const bytes = Buffer.from(image.jpeg);
    objects.push(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n${bytes.toString("latin1")}\nendstream`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const buffer = Buffer.from(pdf, "latin1");

  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}
