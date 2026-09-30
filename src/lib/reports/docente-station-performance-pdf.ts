import "server-only";

import type { DocenteStationPerformance } from "@/lib/docente-station-performance";
import {
  addInstitutionalHeader,
  addPaginatedPdfTable,
  addPdfBorder,
  wrapPdfTextToWidth,
  addPdfRect as addRect,
  addPdfText as addText,
  buildSimplePdf as buildPdf,
  createSimplePdfPage as newPage,
  type SimplePdfPage as PdfPage,
} from "@/lib/reports/simple-pdf";

const MARGIN = 42;
const TEXT_COLOR = "0.09 0.11 0.14";
const MUTED_COLOR = "0.42 0.47 0.52";
const PRIMARY_COLOR = "0.3 0.3 0.3";
const SOFT_COLOR = "0.90 0.90 0.90";

type CategoryKey =
  | "historyCreatedActivities"
  | "patientCreatedActivities"
  | "dataUpdatedActivities";

function formatDate(value?: string) {
  if (!value) {
    return "Sin actividad";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(date);
}

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function addMetric(page: PdfPage, label: string, value: string | number, x: number, y: number) {
  addRect(page, x, y, 96, 52, SOFT_COLOR);
  addPdfBorder(page, x, y, 96, 52);
  addText(page, label, x + 10, y + 33, 8, MUTED_COLOR);
  addText(page, value, x + 10, y + 13, 18, TEXT_COLOR);
}

function addHeader(
  page: PdfPage,
  data: DocenteStationPerformance,
  title = "Rendimiento de estudiantes",
) {
  let y = addInstitutionalHeader(page, title) - 8;
  for (const text of [`${data.station.label} - ${data.activeTrip?.servicio ?? ""}`, data.activeTrip?.establecimiento ?? "", `Generado: ${formatDate(new Date().toISOString())}`]) {
    for (const line of wrapPdfTextToWidth(text, 511, 9)) {
      addText(page, line, MARGIN, y, 9, MUTED_COLOR);
      y -= 13;
    }
  }
  return y;
}

function addSummary(page: PdfPage, data: DocenteStationPerformance) {
  addMetric(page, "Registros", `${data.summary.completed}/${data.summary.requested}`, MARGIN, 628);
  addMetric(page, "Avance", `${data.summary.completionRate}%`, MARGIN + 104, 628);
  addMetric(page, "Estudiantes", data.summary.students, MARGIN + 208, 628);
  addMetric(page, "Actividad", data.summary.totalActivities, MARGIN + 312, 628);
  addMetric(page, "Ediciones", data.summary.updates, MARGIN + 416, 628);
}

function addCategorySummary(page: PdfPage, data: DocenteStationPerformance) {
  const categories: {
    key: CategoryKey;
    label: string;
    total: number;
  }[] = [
    {
      key: "historyCreatedActivities",
      label: "Historias creadas",
      total: data.summary.historiesCreated,
    },
    {
      key: "patientCreatedActivities",
      label: "Pacientes creados",
      total: data.summary.patientsCreated,
    },
    {
      key: "dataUpdatedActivities",
      label: "Datos editados",
      total: data.summary.dataUpdates,
    },
  ];

  addText(page, "Actividad por categoria y actor", MARGIN, 602, 13);

  categories.forEach((category, index) => {
    const yTop = 572 - index * 145;
    const chartY = yTop - 32;
    const barX = 305;
    const barWidth = 180;
    const rows = data.rows
      .map((row) => ({
        name: row.role === "docente" ? `${row.name} (doc.)` : row.name,
        value: row[category.key],
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
    const maxValue = Math.max(...rows.map((row) => row.value), 1);

    addRect(page, MARGIN, yTop - 118, 510, 128, SOFT_COLOR);
    addText(page, category.label, MARGIN + 12, yTop - 18, 11, TEXT_COLOR);
    addText(page, category.total, MARGIN + 12, yTop - 48, 26, TEXT_COLOR);

    rows.forEach((row, rowIndex) => {
      const y = chartY - rowIndex * 14;
      const width = (row.value / maxValue) * barWidth;

      const labelLines = wrapPdfTextToWidth(row.name, 135, 7);
      addText(page, labelLines.length > 1 ? labelLines[0] + "..." : row.name, MARGIN + 118, y + 2, 7, MUTED_COLOR);
      addRect(page, barX, y, barWidth, 7, "0.97 0.98 0.98");
      addRect(page, barX, y, width, 7, PRIMARY_COLOR);
      addText(page, row.value, barX + barWidth + 10, y + 1, 7, TEXT_COLOR);
    });

    if (rows.length === 0) {
      addText(page, "Sin actividad registrada", MARGIN + 118, chartY, 8, MUTED_COLOR);
    }
  });
}

export function getDocenteStationPerformancePdfFileName(data: DocenteStationPerformance) {
  return `rendimiento-${safeFilePart(data.station.label)}.pdf`;
}

function addPerformancePages(
  pages: PdfPage[],
  data: DocenteStationPerformance,
  title = "Rendimiento de estudiantes",
) {
  const summaryPage = newPage();

  pages.push(summaryPage);
  const headerBottom = addHeader(summaryPage, data, title);
  summaryPage.lines.push(`q 1 0 0 1 0 ${Math.min(0, headerBottom - 680)} cm`);
  addSummary(summaryPage, data);
  addCategorySummary(summaryPage, data);
  summaryPage.lines.push("Q");

  if (data.rows.length) addPaginatedPdfTable(
    ["Participante", "Reg.", "Historias atendidas", "Historias creadas", "Pacientes creados", "Datos editados", "Actividad", "\u00daltima actividad"],
    [131, 36, 50, 51, 51, 49, 51, 92],
    data.rows.map((row) => [row.name, String(row.registered), String(row.touchedHistories), String(row.historyCreatedActivities), String(row.patientCreatedActivities), String(row.dataUpdatedActivities), String(row.totalActivities), formatDate(row.lastActivityAt)]),
    () => {
      const page = newPage();
      pages.push(page);
      const y = addHeader(page, data, title) - 12;
      addText(page, "Detalle de participaci\u00f3n", MARGIN, y, 12, TEXT_COLOR, "bold");
      return { page, y: y - 16 };
    },
  );
}

export function renderDocenteStationPerformancePdf(data: DocenteStationPerformance) {
  const pages: PdfPage[] = [];

  addPerformancePages(pages, data);

  return buildPdf(pages);
}

export function getTripPerformancePdfFileName(data: DocenteStationPerformance[]) {
  const first = data[0];

  return `rendimiento-viaje-${safeFilePart(first?.activeTrip?.servicio ?? "general")}.pdf`;
}

export function renderTripPerformancePdf(data: DocenteStationPerformance[]) {
  const pages: PdfPage[] = [];

  data.forEach((performance) => {
    addPerformancePages(
      pages,
      performance,
      `Rendimiento general - ${performance.station.label}`,
    );
  });

  return buildPdf(pages);
}
