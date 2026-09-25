export const SIMPLE_PDF_PAGE_WIDTH = 595;
export const SIMPLE_PDF_PAGE_HEIGHT = 842;

const DEFAULT_TEXT_COLOR = "0.09 0.11 0.14";

export type SimplePdfPage = {
  lines: string[];
};

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
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((page, index) => {
    const contentObjectId = 4 + index * 2;
    const stream = page.lines.join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${SIMPLE_PDF_PAGE_WIDTH} ${SIMPLE_PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
  });

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
