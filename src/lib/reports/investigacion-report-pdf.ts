import "server-only";

import {
  addInstitutionalHeader,
  addPaginatedPdfTable,
  wrapPdfTextToWidth,
  addPdfRect as addRect,
  addPdfText as addText,
  buildSimplePdf as buildPdf,
  createSimplePdfPage as newPage,
  type SimplePdfPage as PdfPage,
} from "@/lib/reports/simple-pdf";

const PAGE_WIDTH = 595;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const MUTED_COLOR = "0.42 0.47 0.52";
const PRIMARY_COLOR = "0.3 0.3 0.3";
const SOFT_COLOR = "0.90 0.90 0.90";

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

function addHeader(page: PdfPage, subtitle = "Resumen estad\u00edstico de historias cl\u00ednicas") {
  let y = addInstitutionalHeader(page, "Reporte de investigaci\u00f3n") - 10;
  for (const line of wrapPdfTextToWidth(subtitle, CONTENT_WIDTH, 10)) {
    addText(page, line, MARGIN, y, 10, MUTED_COLOR);
    y -= 13;
  }
  addText(page, `Generado: ${new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date())}`, MARGIN, y, 8, MUTED_COLOR);
  return y - 22;
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

  rows.slice(0, 22).forEach((row, index) => {
    const value = Number(row[yKey] ?? 0);
    const y = 636 - index * 25;
    const width = Math.max(2, (value / maxValue) * 280);

    const label = wrapPdfTextToWidth(String(row[xKey] ?? "Sin dato"), 175, 8);
    addText(page, label.length > 1 ? label[0] + "..." : label[0], MARGIN, y + 3, 8);
    addRect(page, 230, y, 280, 9, SOFT_COLOR);
    addRect(page, 230, y, width, 9, PRIMARY_COLOR);
    addText(page, value, 520, y + 2, 8);
  });

  if (rows.length > 22) {
    addText(page, `Se muestran 22 de ${rows.length} filas.`, MARGIN, 70, 8, MUTED_COLOR);
  }
}

function addTablePages(pages: PdfPage[], artifact: InvestigacionReportArtifact) {
  const rows = toRows(artifact);
  const allColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  // Keep every column readable; additional groups repeat the first identifying column.
  const groups: string[][] = [];
  for (let offset = 0; offset < allColumns.length; offset += offset === 0 ? 5 : 4) {
    groups.push(offset === 0 ? allColumns.slice(0, 5) : [allColumns[0], ...allColumns.slice(offset, offset + 4)]);
  }
  if (!groups.length) groups.push(["Resultado"]);
  groups.forEach((columns) => addPaginatedPdfTable(
    columns,
    columns.map(() => CONTENT_WIDTH / columns.length),
    rows.length ? rows.map((row) => columns.map((column) => String(row[column] ?? ""))) : [["Sin datos registrados"]],
    () => {
      const page = newPage();
      pages.push(page);
      const y = addHeader(page, artifact.title);
      return { page, y };
    },
  ));
}

export function renderInvestigacionReportPdf(report: InvestigacionReport) {
  const pages: PdfPage[] = [];
  let page = newPage();
  pages.push(page);
  let y = addHeader(page);
  const writeLines = (text: string, bold = false) => {
    for (const line of wrapPdfTextToWidth(text, CONTENT_WIDTH, bold ? 11 : 10, bold ? "bold" : "regular")) {
      if (y < 70) {
        page = newPage();
        pages.push(page);
        y = addHeader(page);
      }
      addText(page, line, MARGIN, y, bold ? 11 : 10, "0.1 0.1 0.1", bold ? "bold" : "regular");
      y -= 14;
    }
    y -= 8;
  };
  writeLines("Resumen", true);
  writeLines(report.answer);
  writeLines("Contenido del reporte", true);
  report.artifacts.forEach((artifact, index) => writeLines(`${index + 1}. ${artifact.title}`));

  report.artifacts.forEach((artifact) => {
    if (artifact.type === "chart") {
      const page = newPage();
      pages.push(page);
      addChartPage(page, artifact);
      addTablePages(pages, artifact);
    } else {
      addTablePages(pages, artifact);
    }
  });

  return buildPdf(pages);
}
