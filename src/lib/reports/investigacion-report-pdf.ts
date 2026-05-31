import "server-only";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TEXT_COLOR = "0.09 0.11 0.14";
const MUTED_COLOR = "0.42 0.47 0.52";
const PRIMARY_COLOR = "0.10 0.38 0.58";
const SOFT_COLOR = "0.90 0.94 0.96";

type PdfPage = {
  lines: string[];
};

export type InvestigacionReportArtifact = {
  data: unknown;
  spec?: {
    x?: string;
    y?: string;
  } | null;
  title: string;
  type: string;
};

export type InvestigacionReport = {
  answer: string;
  artifacts: InvestigacionReportArtifact[];
};

function sanitizeText(value: string | number | undefined) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "-");
}

function escapePdfText(value: string | number | undefined) {
  return sanitizeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function addText(
  page: PdfPage,
  text: string | number,
  x: number,
  y: number,
  size = 10,
  color = TEXT_COLOR,
) {
  page.lines.push(`${color} rg`);
  page.lines.push(`BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`);
}

function addRect(
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  page.lines.push(`${color} rg`);
  page.lines.push(`${x} ${y} ${width} ${height} re f`);
}

function addWrappedText(
  page: PdfPage,
  text: string,
  x: number,
  startY: number,
  maxCharacters = 88,
) {
  const words = sanitizeText(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxCharacters) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }

  if (current) {
    lines.push(current);
  }

  lines.slice(0, 5).forEach((line, index) => {
    addText(page, line, x, startY - index * 14, 9, MUTED_COLOR);
  });

  return startY - Math.min(lines.length, 5) * 14;
}

function newPage(): PdfPage {
  return { lines: [] };
}

function addHeader(page: PdfPage, subtitle = "Resumen estadistico de historias clinicas") {
  addText(page, "Reporte de investigacion", MARGIN, 792, 20);
  addText(page, subtitle, MARGIN, 772, 10, MUTED_COLOR);
  addText(
    page,
    `Generado: ${new Intl.DateTimeFormat("es-BO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/La_Paz",
    }).format(new Date())}`,
    395,
    792,
    8,
    MUTED_COLOR,
  );
}

function toRows(artifact: InvestigacionReportArtifact) {
  return Array.isArray(artifact.data)
    ? (artifact.data as Record<string, unknown>[])
    : [];
}

function addChartPage(page: PdfPage, artifact: InvestigacionReportArtifact) {
  const rows = toRows(artifact);
  const xKey = artifact.spec?.x ?? Object.keys(rows[0] ?? {})[0];
  const yKey = artifact.spec?.y ?? Object.keys(rows[0] ?? {})[1];
  const maxValue = Math.max(...rows.map((row) => Number(row[yKey] ?? 0)), 1);

  addHeader(page, artifact.title);
  addText(page, artifact.title, MARGIN, 730, 14);

  rows.slice(0, 22).forEach((row, index) => {
    const value = Number(row[yKey] ?? 0);
    const y = 690 - index * 25;
    const width = Math.max(2, (value / maxValue) * 280);

    addText(page, String(row[xKey] ?? "Sin dato").slice(0, 30), MARGIN, y + 3, 8);
    addRect(page, 230, y, 280, 9, SOFT_COLOR);
    addRect(page, 230, y, width, 9, PRIMARY_COLOR);
    addText(page, value, 520, y + 2, 8);
  });

  if (rows.length > 22) {
    addText(page, `Se muestran 22 de ${rows.length} filas.`, MARGIN, 118, 8, MUTED_COLOR);
  }
}

function addTablePage(page: PdfPage, artifact: InvestigacionReportArtifact) {
  const rows = toRows(artifact);
  const columns = Object.keys(rows[0] ?? {}).slice(0, 5);
  const columnWidth = CONTENT_WIDTH / Math.max(columns.length, 1);

  addHeader(page, artifact.title);
  addText(page, artifact.title, MARGIN, 730, 14);
  addRect(page, MARGIN, 692, CONTENT_WIDTH, 20, SOFT_COLOR);
  columns.forEach((column, index) => {
    addText(page, column.slice(0, 18), MARGIN + index * columnWidth + 6, 699, 8);
  });
  rows.slice(0, 25).forEach((row, rowIndex) => {
    const y = 674 - rowIndex * 20;

    columns.forEach((column, columnIndex) => {
      addText(
        page,
        String(row[column] ?? "").slice(0, 18),
        MARGIN + columnIndex * columnWidth + 6,
        y,
        8,
      );
    });
  });
}

function buildPdf(pages: PdfPage[]) {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((page, index) => {
    const contentObjectId = 4 + index * 2;
    const stream = page.lines.join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
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

export function renderInvestigacionReportPdf(report: InvestigacionReport) {
  const pages: PdfPage[] = [];
  const summaryPage = newPage();

  pages.push(summaryPage);
  addHeader(summaryPage);
  addText(summaryPage, "Resumen", MARGIN, 730, 14);
  addWrappedText(summaryPage, report.answer, MARGIN, 708);
  addText(summaryPage, "Contenido del reporte", MARGIN, 600, 13);
  report.artifacts.forEach((artifact, index) => {
    addText(summaryPage, `${index + 1}. ${artifact.title}`, MARGIN + 8, 574 - index * 18, 9);
  });

  report.artifacts.forEach((artifact) => {
    const page = newPage();

    pages.push(page);
    if (artifact.type === "chart") {
      addChartPage(page, artifact);
    } else {
      addTablePage(page, artifact);
    }
  });

  return buildPdf(pages);
}
