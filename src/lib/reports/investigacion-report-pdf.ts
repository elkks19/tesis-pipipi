import "server-only";

import sharp from "sharp";

import {
  addInstitutionalHeader,
  addPaginatedPdfTable,
  addPdfImage,
  wrapPdfTextToWidth,
  addPdfText as addText,
  buildSimplePdf as buildPdf,
  createSimplePdfPage as newPage,
  type PdfImage,
  type SimplePdfPage as PdfPage,
} from "@/lib/reports/simple-pdf";

const PAGE_WIDTH = 595;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const MUTED_COLOR = "0.42 0.47 0.52";
const TEXT_COLOR = "0.1 0.1 0.1";
const CHART_WIDTH = 1000;
const CHART_HEIGHT = 560;
const COLORS = ["#1d4ed8", "#0f766e", "#b45309", "#be123c", "#6d28d9", "#0369a1"];

export type InvestigacionReportArtifact = {
  data: unknown;
  spec?: {
    description?: string;
    group?: string;
    kind?: string;
    series?: string;
    x?: string;
    y?: string;
  } | null;
  title: string;
  type: string;
};

export type InvestigacionReportSource = {
  documentType?: string;
  score?: number;
  title: string;
};

export type InvestigacionReport = {
  answer: string;
  artifacts: InvestigacionReportArtifact[];
  generatedAt: Date;
  question: string;
  requestedBy: string;
  requestedRole: string;
  scopeLabel: string;
  sources: InvestigacionReportSource[];
  title: string;
};

function addHeader(page: PdfPage, title: string, subtitle?: string) {
  let y = addInstitutionalHeader(page, title) - 10;
  if (subtitle) {
    for (const line of wrapPdfTextToWidth(subtitle, CONTENT_WIDTH, 10)) {
      addText(page, line, MARGIN, y, 10, MUTED_COLOR);
      y -= 13;
    }
  }
  return y - 12;
}

function toRows(artifact: InvestigacionReportArtifact) {
  return Array.isArray(artifact.data)
    ? artifact.data.filter(isRecord)
    : [];
}

function addTablePages(pages: PdfPage[], artifact: InvestigacionReportArtifact) {
  const rows = toRows(artifact);
  const allColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const groups: string[][] = [];
  for (let offset = 0; offset < allColumns.length; offset += offset === 0 ? 5 : 4) {
    groups.push(
      offset === 0
        ? allColumns.slice(0, 5)
        : [allColumns[0], ...allColumns.slice(offset, offset + 4)],
    );
  }
  if (!groups.length) groups.push(["Resultado"]);

  groups.forEach((columns) =>
    addPaginatedPdfTable(
      columns,
      columns.map(() => CONTENT_WIDTH / columns.length),
      rows.length
        ? rows.map((row) => columns.map((column) => String(row[column] ?? "")))
        : [["Sin datos registrados"]],
      () => {
        const page = newPage();
        pages.push(page);
        const y = addHeader(page, "Reporte de investigación", artifact.title);
        return { page, y };
      },
    ),
  );
}

async function renderChartImage(
  artifact: InvestigacionReportArtifact,
): Promise<{ image: PdfImage; note?: string } | null> {
  const result = buildChartSvg(artifact);
  if (!result) return null;

  const jpeg = await sharp(Buffer.from(result.svg))
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88 })
    .toBuffer();

  return {
    image: {
      height: CHART_HEIGHT,
      jpeg: new Uint8Array(jpeg),
      width: CHART_WIDTH,
    },
    note: result.note,
  };
}

function buildChartSvg(artifact: InvestigacionReportArtifact) {
  const rows = toRows(artifact);
  if (!rows.length) return null;

  const xKey = artifact.spec?.x ?? Object.keys(rows[0] ?? {})[0] ?? "label";
  const yKey = artifact.spec?.y ?? Object.keys(rows[0] ?? {})[1] ?? "value";
  const kind = artifact.spec?.kind ?? "bar";
  const values = rows.map((row, index) => ({
    label: String(row[xKey] ?? index + 1),
    value: finiteNumber(row[yKey]),
  }));

  let content = "";
  let note: string | undefined;

  if (kind === "pie") {
    const visible = values.slice(0, 11);
    if (values.length > 11) {
      visible.push({
        label: "Otros",
        value: values.slice(11).reduce((total, row) => total + Math.max(0, row.value), 0),
      });
      note = `El gráfico agrupa ${values.length - 11} categorías adicionales como Otros; la tabla conserva el detalle completo.`;
    }
    content = pieSvg(visible);
  } else if (kind === "line") {
    const visible = values.slice(0, 24);
    if (values.length > visible.length) {
      note = `El gráfico muestra 24 de ${values.length} puntos; la tabla conserva todos los datos.`;
    }
    content = lineSvg(visible);
  } else if (kind === "scatter") {
    const points = rows.slice(0, 120).map((row, index) => {
      const rawX = Number(row[xKey]);
      return {
        label: String(row[xKey] ?? index + 1),
        x: Number.isFinite(rawX) ? rawX : index + 1,
        y: finiteNumber(row[yKey]),
      };
    });
    if (rows.length > points.length) {
      note = `El gráfico muestra 120 de ${rows.length} puntos; la tabla conserva todos los datos.`;
    }
    content = scatterSvg(points);
  } else if (kind === "heatmap") {
    const result = heatmapSvg(rows, {
      groupKey:
        artifact.spec?.group ??
        artifact.spec?.series ??
        Object.keys(rows[0] ?? {})[1] ??
        "grupo",
      valueKey: yKey,
      xKey,
    });
    content = result.content;
    note = result.note;
  } else {
    const visible = values.slice(0, 14);
    if (values.length > visible.length) {
      note = `El gráfico muestra 14 de ${values.length} categorías; la tabla conserva todos los datos.`;
    }
    content = barSvg(visible);
  }

  if (!content) return null;
  return {
    note,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <style>
        text { font-family: Arial, sans-serif; fill: #1f2937; }
        .muted { fill: #64748b; }
        .grid { stroke: #e2e8f0; stroke-width: 1; }
      </style>
      ${content}
    </svg>`,
  };
}

function barSvg(rows: Array<{ label: string; value: number }>) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  const left = 270;
  const available = 650;
  const rowHeight = Math.min(34, 440 / Math.max(rows.length, 1));

  return rows
    .map((row, index) => {
      const y = 54 + index * rowHeight;
      const width = Math.max(2, (Math.abs(row.value) / max) * available);
      return `
        <text x="${left - 16}" y="${y + 15}" font-size="16" text-anchor="end">${xml(shortLabel(row.label, 27))}</text>
        <rect x="${left}" y="${y}" width="${available}" height="18" rx="5" fill="#e2e8f0"/>
        <rect x="${left}" y="${y}" width="${width}" height="18" rx="5" fill="${COLORS[index % COLORS.length]}"/>
        <text x="${Math.min(left + width + 10, 960)}" y="${y + 15}" font-size="15">${formatNumber(row.value)}</text>
      `;
    })
    .join("");
}

function lineSvg(rows: Array<{ label: string; value: number }>) {
  if (!rows.length) return "";
  const left = 80;
  const top = 45;
  const width = 850;
  const height = 390;
  const values = rows.map((row) => row.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const x = (index: number) =>
    left + (rows.length === 1 ? width / 2 : (index / (rows.length - 1)) * width);
  const y = (value: number) => top + height - ((value - min) / span) * height;
  const points = rows.map((row, index) => `${x(index)},${y(row.value)}`).join(" ");
  const labels = rows
    .map((row, index) =>
      index % Math.max(1, Math.ceil(rows.length / 8)) === 0
        ? `<text x="${x(index)}" y="475" font-size="13" text-anchor="middle">${xml(shortLabel(row.label, 12))}</text>`
        : "",
    )
    .join("");

  return `
    ${[0, 1, 2, 3, 4].map((step) => `<line class="grid" x1="${left}" y1="${top + step * height / 4}" x2="${left + width}" y2="${top + step * height / 4}"/>`).join("")}
    <polyline fill="none" stroke="${COLORS[0]}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" points="${points}"/>
    ${rows.map((row, index) => `<circle cx="${x(index)}" cy="${y(row.value)}" r="6" fill="#ffffff" stroke="${COLORS[0]}" stroke-width="4"/>`).join("")}
    <text x="60" y="${top + 5}" font-size="14" text-anchor="end">${formatNumber(max)}</text>
    <text x="60" y="${top + height}" font-size="14" text-anchor="end">${formatNumber(min)}</text>
    ${labels}
  `;
}

function pieSvg(rows: Array<{ label: string; value: number }>) {
  const positive = rows.filter((row) => row.value > 0);
  const total = positive.reduce((sum, row) => sum + row.value, 0);
  if (!total) return "";

  let angle = -Math.PI / 2;
  const cx = 300;
  const cy = 280;
  const radius = 190;
  const slices: string[] = [];
  const legend: string[] = [];

  positive.forEach((row, index) => {
    const nextAngle = angle + (row.value / total) * Math.PI * 2;
    const x1 = cx + radius * Math.cos(angle);
    const y1 = cy + radius * Math.sin(angle);
    const x2 = cx + radius * Math.cos(nextAngle);
    const y2 = cy + radius * Math.sin(nextAngle);
    const large = nextAngle - angle > Math.PI ? 1 : 0;
    const color = COLORS[index % COLORS.length];
    slices.push(
      `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}" stroke="#ffffff" stroke-width="3"/>`,
    );
    legend.push(`
      <rect x="565" y="${70 + index * 38}" width="20" height="20" rx="4" fill="${color}"/>
      <text x="600" y="${86 + index * 38}" font-size="16">${xml(shortLabel(row.label, 27))} · ${formatPercent(row.value / total)}</text>
    `);
    angle = nextAngle;
  });

  return slices.join("") + legend.join("");
}

function scatterSvg(
  rows: Array<{ label: string; x: number; y: number }>,
) {
  if (!rows.length) return "";
  const left = 85;
  const top = 45;
  const width = 830;
  const height = 420;
  const xMin = Math.min(...rows.map((row) => row.x));
  const xMax = Math.max(...rows.map((row) => row.x));
  const yMin = Math.min(...rows.map((row) => row.y));
  const yMax = Math.max(...rows.map((row) => row.y));
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;
  const px = (value: number) => left + ((value - xMin) / xSpan) * width;
  const py = (value: number) => top + height - ((value - yMin) / ySpan) * height;

  return `
    ${[0, 1, 2, 3, 4].map((step) => `
      <line class="grid" x1="${left}" y1="${top + step * height / 4}" x2="${left + width}" y2="${top + step * height / 4}"/>
      <line class="grid" x1="${left + step * width / 4}" y1="${top}" x2="${left + step * width / 4}" y2="${top + height}"/>
    `).join("")}
    ${rows.map((row, index) => `<circle cx="${px(row.x)}" cy="${py(row.y)}" r="7" fill="${COLORS[index % COLORS.length]}" fill-opacity="0.75"><title>${xml(row.label)}: ${formatNumber(row.y)}</title></circle>`).join("")}
    <text x="${left}" y="510" font-size="14">${formatNumber(xMin)}</text>
    <text x="${left + width}" y="510" font-size="14" text-anchor="end">${formatNumber(xMax)}</text>
    <text x="68" y="${top + 8}" font-size="14" text-anchor="end">${formatNumber(yMax)}</text>
    <text x="68" y="${top + height}" font-size="14" text-anchor="end">${formatNumber(yMin)}</text>
  `;
}

function heatmapSvg(
  rows: Record<string, unknown>[],
  keys: { groupKey: string; valueKey: string; xKey: string },
) {
  const allX = [...new Set(rows.map((row) => String(row[keys.xKey] ?? "Sin dato")))];
  const allY = [...new Set(rows.map((row) => String(row[keys.groupKey] ?? "Sin dato")))];
  const xLabels = allX.slice(0, 10);
  const yLabels = allY.slice(0, 9);
  const values = new Map(
    rows.map((row) => [
      `${String(row[keys.xKey] ?? "Sin dato")}::${String(row[keys.groupKey] ?? "Sin dato")}`,
      finiteNumber(row[keys.valueKey]),
    ]),
  );
  const max = Math.max(...values.values(), 1);
  const left = 205;
  const top = 105;
  const cellWidth = Math.min(72, 730 / Math.max(xLabels.length, 1));
  const cellHeight = Math.min(42, 360 / Math.max(yLabels.length, 1));
  let content = "";

  xLabels.forEach((label, index) => {
    content += `<text x="${left + index * cellWidth + cellWidth / 2}" y="82" font-size="13" text-anchor="middle">${xml(shortLabel(label, 10))}</text>`;
  });
  yLabels.forEach((label, rowIndex) => {
    content += `<text x="${left - 12}" y="${top + rowIndex * cellHeight + cellHeight / 2 + 5}" font-size="14" text-anchor="end">${xml(shortLabel(label, 20))}</text>`;
    xLabels.forEach((column, columnIndex) => {
      const value = values.get(`${column}::${label}`) ?? 0;
      const opacity = Math.max(0.08, value / max);
      content += `
        <rect x="${left + columnIndex * cellWidth}" y="${top + rowIndex * cellHeight}" width="${cellWidth - 2}" height="${cellHeight - 2}" rx="4" fill="${COLORS[0]}" fill-opacity="${opacity}"/>
        <text x="${left + columnIndex * cellWidth + cellWidth / 2}" y="${top + rowIndex * cellHeight + cellHeight / 2 + 5}" font-size="14" text-anchor="middle" fill="${opacity > 0.55 ? "#ffffff" : "#1f2937"}">${formatNumber(value)}</text>
      `;
    });
  });

  const truncated = allX.length > xLabels.length || allY.length > yLabels.length;
  return {
    content,
    note: truncated
      ? `El mapa muestra ${xLabels.length} de ${allX.length} columnas y ${yLabels.length} de ${allY.length} filas; la tabla conserva todos los datos.`
      : undefined,
  };
}

export async function renderInvestigacionReportPdf(report: InvestigacionReport) {
  const pages: PdfPage[] = [];
  let page = newPage();
  pages.push(page);
  let y = addHeader(page, report.title, "Reporte analítico generado desde el asistente");

  const writeLines = (text: string, bold = false, size = bold ? 11 : 10) => {
    for (const line of wrapPdfTextToWidth(
      text,
      CONTENT_WIDTH,
      size,
      bold ? "bold" : "regular",
    )) {
      if (y < 70) {
        page = newPage();
        pages.push(page);
        y = addHeader(page, report.title);
      }
      addText(page, line, MARGIN, y, size, TEXT_COLOR, bold ? "bold" : "regular");
      y -= size + 4;
    }
    y -= 7;
  };

  writeLines(
    `Generado: ${new Intl.DateTimeFormat("es-BO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/La_Paz",
    }).format(report.generatedAt)} · Solicitado por: ${report.requestedBy} (${report.requestedRole})`,
    false,
    8,
  );
  writeLines(`Alcance: ${report.scopeLabel}`, false, 9);
  writeLines("Consulta", true);
  writeLines(report.question || "Reporte predefinido");
  writeLines("Análisis", true);
  writeLines(report.answer);
  writeLines("Metodología", true);
  writeLines(
    "Los conteos y cálculos proceden de herramientas determinísticas aplicadas al alcance indicado. El modelo redacta la interpretación y no sustituye una evaluación clínica.",
  );

  if (report.sources.length) {
    writeLines("Fuentes consultadas", true);
    report.sources.forEach((source, index) =>
      writeLines(
        `${index + 1}. ${source.title}${source.documentType ? ` · ${source.documentType}` : ""}`,
        false,
        9,
      ),
    );
  }

  if (report.artifacts.length) {
    writeLines("Contenido del reporte", true);
    report.artifacts.forEach((artifact, index) =>
      writeLines(`${index + 1}. ${artifact.title}`, false, 9),
    );
  }

  for (const artifact of report.artifacts) {
    if (artifact.type === "chart") {
      const chart = await renderChartImage(artifact);
      if (chart) {
        const chartPage = newPage();
        pages.push(chartPage);
        const chartY = addHeader(chartPage, "Reporte de investigación", artifact.title);
        addPdfImage(chartPage, chart.image, MARGIN, chartY - 420, CONTENT_WIDTH, 286);
        if (artifact.spec?.description) {
          addText(chartPage, artifact.spec.description, MARGIN, chartY - 442, 8, MUTED_COLOR);
        }
        if (chart.note) {
          const lines = wrapPdfTextToWidth(chart.note, CONTENT_WIDTH, 8);
          lines.forEach((line, index) =>
            addText(chartPage, line, MARGIN, chartY - 462 - index * 11, 8, MUTED_COLOR),
          );
        }
      }
      addTablePages(pages, artifact);
    } else {
      addTablePages(pages, artifact);
    }
  }

  return buildPdf(pages);
}

function finiteNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function shortLabel(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-BO", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);
}

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
