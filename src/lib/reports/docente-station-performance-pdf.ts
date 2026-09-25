import "server-only";

import type { DocenteStationPerformance } from "@/lib/docente-station-performance";
import {
  addPdfRect as addRect,
  addPdfText as addText,
  buildSimplePdf as buildPdf,
  createSimplePdfPage as newPage,
  type SimplePdfPage as PdfPage,
} from "@/lib/reports/simple-pdf";

const MARGIN = 42;
const TEXT_COLOR = "0.09 0.11 0.14";
const MUTED_COLOR = "0.42 0.47 0.52";
const PRIMARY_COLOR = "0.10 0.38 0.58";
const SOFT_COLOR = "0.90 0.94 0.96";

type PerformanceRow = DocenteStationPerformance["rows"][number];
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
  addText(page, label, x + 10, y + 33, 8, MUTED_COLOR);
  addText(page, value, x + 10, y + 13, 18, TEXT_COLOR);
}

function addHeader(
  page: PdfPage,
  data: DocenteStationPerformance,
  title = "Rendimiento de estudiantes",
) {
  addText(page, title, MARGIN, 792, 20);
  addText(page, `${data.station.label} - ${data.activeTrip?.servicio ?? ""}`, MARGIN, 772, 10, MUTED_COLOR);
  addText(page, data.activeTrip?.establecimiento ?? "", MARGIN, 758, 10, MUTED_COLOR);
  addText(page, `Generado: ${formatDate(new Date().toISOString())}`, 408, 792, 8, MUTED_COLOR);
}

function addSummary(page: PdfPage, data: DocenteStationPerformance) {
  addMetric(page, "Registros", `${data.summary.completed}/${data.summary.requested}`, MARGIN, 686);
  addMetric(page, "Avance", `${data.summary.completionRate}%`, MARGIN + 104, 686);
  addMetric(page, "Estudiantes", data.summary.students, MARGIN + 208, 686);
  addMetric(page, "Actividad", data.summary.totalActivities, MARGIN + 312, 686);
  addMetric(page, "Ediciones", data.summary.updates, MARGIN + 416, 686);
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

  addText(page, "Actividad por categoria y actor", MARGIN, 660, 13);

  categories.forEach((category, index) => {
    const yTop = 630 - index * 145;
    const chartY = yTop - 32;
    const barX = 230;
    const barWidth = 255;
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

      addText(page, row.name.slice(0, 28), MARGIN + 118, y + 2, 7, MUTED_COLOR);
      addRect(page, barX, y, barWidth, 7, "0.97 0.98 0.98");
      addRect(page, barX, y, width, 7, PRIMARY_COLOR);
      addText(page, row.value, barX + barWidth + 10, y + 1, 7, TEXT_COLOR);
    });

    if (rows.length === 0) {
      addText(page, "Sin actividad registrada", MARGIN + 118, chartY, 8, MUTED_COLOR);
    }
  });
}

function addTableHeader(page: PdfPage, y: number) {
  addRect(page, MARGIN, y - 6, 510, 18, SOFT_COLOR);
  addText(page, "Estudiante", MARGIN + 8, y, 8);
  addText(page, "Reg.", 242, y, 8);
  addText(page, "Hist.", 288, y, 8);
  addText(page, "Creados", 330, y, 8);
  addText(page, "Edit.", 386, y, 8);
  addText(page, "Act.", 430, y, 8);
  addText(page, "Ultima", 474, y, 8);
}

function addTable(
  page: PdfPage,
  rows: PerformanceRow[],
  startY: number,
  title = "Detalle por estudiante",
) {
  addText(page, title, MARGIN, startY + 28, 13);
  addTableHeader(page, startY);

  rows.forEach((row, index) => {
    const y = startY - 24 - index * 20;

    addText(page, row.name.slice(0, 30), MARGIN + 8, y, 8);
    addText(page, row.registered, 248, y, 8);
    addText(page, row.touchedHistories, 294, y, 8);
    addText(page, `${row.historyCreatedActivities}/${row.patientCreatedActivities}`, 336, y, 8);
    addText(page, row.dataUpdatedActivities, 394, y, 8);
    addText(page, row.totalActivities, 436, y, 8);
    addText(page, formatDate(row.lastActivityAt).slice(0, 18), 474, y, 8, MUTED_COLOR);
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
  addHeader(summaryPage, data, title);
  addSummary(summaryPage, data);
  addCategorySummary(summaryPage, data);

  for (let index = 0; index < data.rows.length; index += 30) {
    const nextPage = newPage();

    addHeader(nextPage, data, title);
    addTable(nextPage, data.rows.slice(index, index + 30), 720);
    pages.push(nextPage);
  }
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
