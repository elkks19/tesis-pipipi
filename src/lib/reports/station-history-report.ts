import "server-only";

import { db } from "@/lib/db";
import type { Historia, Paciente } from "@/lib/schema";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;

type PacienteDocument = PouchDB.Core.ExistingDocument<Paciente>;

type StationReportRow = {
  completed: boolean;
  details: string;
  label: string;
  requested: boolean;
  selected: boolean;
  status: string;
};

type ReportItem = {
  label: string;
  value: string;
};

type ReportFile = {
  href: string;
  meta: string;
  name: string;
};

type ReportSection = {
  files?: ReportFile[];
  items: ReportItem[];
  title: string;
};

function isHistoria(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia" &&
    "_id" in doc
  );
}

function isPaciente(doc: unknown): doc is PacienteDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente" &&
    "_id" in doc
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "Sin registro";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPacienteName(paciente: PacienteDocument | null) {
  if (!paciente) {
    return "Paciente no encontrado";
  }

  const { nombres, apellidoPaterno, apellidoMaterno } =
    paciente.datosPersonales;

  return [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ");
}

function getPacienteDocument(paciente: PacienteDocument | null) {
  if (!paciente) {
    return "Sin documento";
  }

  const datos = paciente.datosPersonales;

  return `${datos.documentoIdentidad} ${datos.numeroDocumentoIdentidad}`;
}

function valueOrEmpty(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "Sin registro";
  }

  return String(value);
}

function formatBoolean(value: boolean | undefined) {
  if (value === undefined) {
    return "Sin registro";
  }

  return value ? "Si" : "No";
}

function formatNumber(value: number | undefined, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Sin registro";
  }

  return `${value}${suffix ? ` ${suffix}` : ""}`;
}

function formatFileSize(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Tamano sin registro";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getStoredFileHref(key: string | undefined) {
  if (!key) {
    return "";
  }

  return `/archivos/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function joinValues(values: unknown[]) {
  return values.map(valueOrEmpty).filter((value) => value !== "Sin registro").join(" | ");
}

function stationRequested(historia: HistoriaDocument, stationKey: StationKey) {
  const config = stationConfigs[stationKey];

  if (!("complementaryKey" in config)) {
    return true;
  }

  return Boolean(historia.examenesComplementariosSolicitados?.[config.complementaryKey]);
}

function stationDetails(historia: HistoriaDocument, stationKey: StationKey) {
  switch (stationKey) {
    case "anamnesis":
      return joinValues([
        historia.anamnesis?.motivoConsulta,
        historia.anamnesis?.historiaEnfermedadActual,
      ]);
    case "examenFisicoGeneral":
      return joinValues([
        historia.examenFisicoGeneral?.diagnosticoIMC,
        historia.examenFisicoGeneral?.frecuenciaCardiaca
          ? `FC ${historia.examenFisicoGeneral.frecuenciaCardiaca}`
          : "",
        historia.examenFisicoGeneral?.imc
          ? `IMC ${historia.examenFisicoGeneral.imc}`
          : "",
      ]);
    case "examenFisicoSegmentario":
      return joinValues([
        historia.examenFisicoSegmentario?.cabeza,
        historia.examenFisicoSegmentario?.aparatoRespiratorio,
        historia.examenFisicoSegmentario?.aparatoCardiovascular,
      ]);
    case "ecografia":
      return joinValues([
        historia.ecografia?.higado.diagnostico,
        historia.ecografia?.vesiculaBiliar.diagnostico,
      ]);
    case "electrocardiograma":
      return joinValues([
        historia.electrocardiograma?.diagnostico,
        historia.electrocardiograma?.ritmo,
      ]);
    case "espirometria":
      return joinValues([
        historia.espirometria?.diagnostico,
        historia.espirometria?.FEV1FVC
          ? `FEV1/FVC ${historia.espirometria.FEV1FVC}`
          : "",
      ]);
    case "laboratorios":
      return joinValues([
        historia.laboratorios?.grupoSanguineo,
        historia.laboratorios?.glicemiaCapilar
          ? `Glicemia ${historia.laboratorios.glicemiaCapilar}`
          : "",
      ]);
    case "diagnostico":
      return joinValues([
        historia.diagnostico?.principal.title || historia.diagnostico?.principal.code,
        historia.diagnostico?.planTrabajo,
      ]);
  }
}

function stationUpdatedAt(historia: HistoriaDocument, stationKey: StationKey) {
  const config = stationConfigs[stationKey];
  const value = historia[config.field] as
    | { created_by?: string; updated_by?: string }
    | undefined;

  return value?.updated_by || value?.created_by ? "Con auditoria" : "Sin auditoria";
}

function buildRows(historia: HistoriaDocument, selectedStationKey: StationKey) {
  return Object.entries(stationConfigs).map(([key, config]): StationReportRow => {
    const stationKey = key as StationKey;
    const requested = stationRequested(historia, stationKey);
    const completed = Boolean(historia[config.field]);
    const status = !requested
      ? "No solicitada"
      : completed
        ? "Registrada"
        : "Pendiente";

    return {
      completed,
      details: stationDetails(historia, stationKey) || stationUpdatedAt(historia, stationKey),
      label: config.viajeTipo,
      requested,
      selected: stationKey === selectedStationKey,
      status,
    };
  });
}

function addSection(
  sections: ReportSection[],
  section: ReportSection | false | null | undefined,
) {
  if (!section) {
    return;
  }

  const hasItems = section.items.some((item) => item.value !== "Sin registro");
  const hasFiles = Boolean(section.files?.length);

  if (hasItems || hasFiles) {
    sections.push(section);
  }
}

function buildReportSections(historia: HistoriaDocument): ReportSection[] {
  const sections: ReportSection[] = [];

  addSection(
    sections,
    historia.anamnesis && {
      items: [
        { label: "Motivo de consulta", value: valueOrEmpty(historia.anamnesis.motivoConsulta) },
        {
          label: "Enfermedad actual",
          value: valueOrEmpty(historia.anamnesis.historiaEnfermedadActual),
        },
        {
          label: "Actividad fisica",
          value: formatBoolean(
            historia.anamnesis.antecedentesNoPatologicos.realizaActividadFisica,
          ),
        },
        {
          label: "Tabaco",
          value: valueOrEmpty(
            historia.anamnesis.antecedentesNoPatologicos.habitoTabaquico,
          ),
        },
        {
          label: "Alcohol",
          value: valueOrEmpty(
            historia.anamnesis.antecedentesNoPatologicos.consumoAlcohol,
          ),
        },
      ],
      title: "Anamnesis",
    },
  );

  addSection(
    sections,
    historia.examenFisicoGeneral && {
      items: [
        {
          label: "Presion derecha",
          value: `${formatNumber(
            historia.examenFisicoGeneral.presionArterial.derecha.max,
            "mmHg",
          )} / ${formatNumber(
            historia.examenFisicoGeneral.presionArterial.derecha.min,
            "mmHg",
          )}`,
        },
        {
          label: "Presion izquierda",
          value: `${formatNumber(
            historia.examenFisicoGeneral.presionArterial.izquierda.max,
            "mmHg",
          )} / ${formatNumber(
            historia.examenFisicoGeneral.presionArterial.izquierda.min,
            "mmHg",
          )}`,
        },
        {
          label: "Signos vitales",
          value: joinValues([
            `FC ${formatNumber(historia.examenFisicoGeneral.frecuenciaCardiaca, "lpm")}`,
            `FR ${formatNumber(historia.examenFisicoGeneral.frecuenciaRespiratoria, "rpm")}`,
            `Temp. ${formatNumber(historia.examenFisicoGeneral.temperaturaAxilar, "C")}`,
          ]),
        },
        {
          label: "Antropometria",
          value: joinValues([
            `Peso ${formatNumber(historia.examenFisicoGeneral.peso, "kg")}`,
            `Talla ${formatNumber(historia.examenFisicoGeneral.talla, "cm")}`,
            `IMC ${formatNumber(historia.examenFisicoGeneral.imc)}`,
            historia.examenFisicoGeneral.diagnosticoIMC,
          ]),
        },
      ],
      title: "Examen fisico general",
    },
  );

  addSection(
    sections,
    historia.examenFisicoSegmentario && {
      items: [
        { label: "Cabeza", value: valueOrEmpty(historia.examenFisicoSegmentario.cabeza) },
        { label: "Cuello", value: valueOrEmpty(historia.examenFisicoSegmentario.cuello) },
        {
          label: "Respiratorio",
          value: valueOrEmpty(historia.examenFisicoSegmentario.aparatoRespiratorio),
        },
        {
          label: "Cardiovascular",
          value: valueOrEmpty(historia.examenFisicoSegmentario.aparatoCardiovascular),
        },
        {
          label: "Abdomen y pelvis",
          value: valueOrEmpty(historia.examenFisicoSegmentario.abdomenPelvis),
        },
        {
          label: "Neurologico",
          value: valueOrEmpty(historia.examenFisicoSegmentario.sistemaNerviosoCentral),
        },
      ],
      title: "Examen fisico segmentario",
    },
  );

  addSection(
    sections,
    historia.ecografia && {
      files: historia.ecografia.imagen
        ? [
            {
              href:
                historia.ecografia.imagen.url ||
                getStoredFileHref(historia.ecografia.imagen.key),
              meta: [
                historia.ecografia.imagen.tipo,
                formatFileSize(historia.ecografia.imagen.tamano),
              ]
                .filter(Boolean)
                .join(" - "),
              name: historia.ecografia.imagen.nombre || "Imagen de ecografia",
            },
          ]
        : [],
      items: [
        { label: "Higado", value: valueOrEmpty(historia.ecografia.higado.diagnostico) },
        {
          label: "Vesicula biliar",
          value: valueOrEmpty(historia.ecografia.vesiculaBiliar.diagnostico),
        },
        { label: "Rinones", value: valueOrEmpty(historia.ecografia.riñones.diagnostico) },
      ],
      title: "Ecografia",
    },
  );

  addSection(
    sections,
    historia.electrocardiograma && {
      items: [
        {
          label: "Diagnostico",
          value: valueOrEmpty(historia.electrocardiograma.diagnostico),
        },
        { label: "Ritmo", value: valueOrEmpty(historia.electrocardiograma.ritmo) },
        {
          label: "Frecuencia cardiaca",
          value: formatNumber(historia.electrocardiograma.frecuenciaCardiaca, "lpm"),
        },
        {
          label: "Intervalos",
          value: joinValues([
            `PR ${formatNumber(historia.electrocardiograma.intervaloPR)}`,
            `QTc ${formatNumber(historia.electrocardiograma.intervaloQTc)}`,
          ]),
        },
      ],
      title: "Electrocardiograma",
    },
  );

  addSection(
    sections,
    historia.espirometria && {
      items: [
        { label: "Diagnostico", value: valueOrEmpty(historia.espirometria.diagnostico) },
        {
          label: "FEV1",
          value: `${formatNumber(historia.espirometria.FEV1)} (${formatNumber(historia.espirometria.porcentajeFEVteorico, "%")})`,
        },
        {
          label: "FVC",
          value: `${formatNumber(historia.espirometria.FVC)} (${formatNumber(historia.espirometria.porcentajeFVCteorico, "%")})`,
        },
        {
          label: "FEV1/FVC",
          value: `${formatNumber(historia.espirometria.FEV1FVC)} (${formatNumber(historia.espirometria.porcentajeFEV1FVCteorico, "%")})`,
        },
        {
          label: "Observaciones",
          value: historia.espirometria.observaciones.join(", ") || "Sin registro",
        },
      ],
      title: "Espirometria",
    },
  );

  addSection(
    sections,
    historia.laboratorios && {
      items: [
        {
          label: "Grupo sanguineo",
          value: valueOrEmpty(historia.laboratorios.grupoSanguineo),
        },
        {
          label: "Glicemia capilar",
          value: valueOrEmpty(historia.laboratorios.glicemiaCapilar),
        },
        {
          label: "Otros estudios",
          value:
            historia.laboratorios.otrosEstudios
              ?.map((item) => `${item.nombre}: ${item.resultado}`)
              .join(" | ") || "Sin registro",
        },
      ],
      title: "Laboratorios",
    },
  );

  addSection(
    sections,
    historia.diagnostico && {
      items: [
        {
          label: "Principal",
          value:
            historia.diagnostico.principal.title ||
            historia.diagnostico.principal.code,
        },
        {
          label: "Secundarios",
          value:
            historia.diagnostico.secundarios
              .map((item) => item.title || item.code)
              .join(", ") || "Sin registro",
        },
        { label: "Plan de trabajo", value: valueOrEmpty(historia.diagnostico.planTrabajo) },
      ],
      title: "Diagnostico",
    },
  );

  return sections;
}

async function getPaciente(pacienteId: string) {
  try {
    const doc = await db.get(pacienteId);

    return isPaciente(doc) ? doc : null;
  } catch {
    return null;
  }
}

export async function buildStationHistoryReport({
  historiaId,
  stationKey,
}: {
  historiaId: string;
  stationKey: string;
}) {
  if (!(stationKey in stationConfigs)) {
    return null;
  }

  const selectedStationKey = stationKey as StationKey;
  let historia: HistoriaDocument;

  try {
    const doc = await db.get(historiaId);

    if (!isHistoria(doc)) {
      return null;
    }

    historia = doc;
  } catch {
    return null;
  }

  const paciente = await getPaciente(historia.pacienteId);
  const rows = buildRows(historia, selectedStationKey);
  const requiredRows = rows.filter((row) => row.requested);
  const completedRows = requiredRows.filter((row) => row.completed);
  const selectedConfig = stationConfigs[selectedStationKey];
  const registeredRows = rows.filter((row) => row.completed);

  return {
    fileName: `reporte-${getFileName(selectedConfig.viajeTipo)}-${getFileName(getPacienteName(paciente))}.html`,
    generatedAt: new Date().toISOString(),
    historiaId: historia._id,
    paciente: {
      documento: getPacienteDocument(paciente),
      genero: paciente?.genero ?? "Sin registro",
      nombre: getPacienteName(paciente),
    },
    progress: {
      completed: completedRows.length,
      pending: Math.max(0, requiredRows.length - completedRows.length),
      required: requiredRows.length,
    },
    rows,
    registeredRows,
    sections: buildReportSections(historia),
    selectedStation: {
      label: selectedConfig.viajeTipo,
      status: rows.find((row) => row.selected)?.status ?? "Sin estado",
    },
  };
}

export function renderStationHistoryReportHtml(
  data: NonNullable<Awaited<ReturnType<typeof buildStationHistoryReport>>>,
) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reporte ${escapeHtml(data.selectedStation.label)}</title>
  <style>
    body { color: #111; font-family: Arial, sans-serif; margin: 24px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 24px; }
    h2 { border-bottom: 2px solid #111; font-size: 16px; margin-top: 24px; padding-bottom: 6px; }
    h3 { font-size: 15px; margin-top: 16px; }
    .actions { margin-bottom: 16px; }
    .actions button { background: white; border: 1px solid #111; cursor: pointer; padding: 8px 12px; }
    .header { border: 2px solid #111; display: grid; gap: 16px; grid-template-columns: 1.3fr 1fr; padding: 16px; }
    .muted { color: #555; }
    .section { border: 1px solid #999; margin-top: 12px; padding: 12px; }
    .section-grid { display: grid; gap: 8px; grid-template-columns: repeat(2, 1fr); margin-top: 10px; }
    .item { border: 1px solid #ccc; padding: 8px; }
    .item span, .file span { color: #555; display: block; font-size: 11px; margin-bottom: 4px; }
    .item strong { font-size: 12px; white-space: pre-wrap; }
    .files { display: grid; gap: 8px; margin-top: 10px; }
    .file { border: 1px dashed #999; padding: 8px; }
    .file a { color: #111; font-weight: 700; }
    .stats { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); margin-top: 12px; }
    .stat { border: 1px solid #999; padding: 10px; }
    .stat strong { display: block; font-size: 24px; margin-top: 4px; }
    table { border-collapse: collapse; margin-top: 10px; width: 100%; }
    th, td { border: 1px solid #999; font-size: 12px; padding: 7px; text-align: left; vertical-align: top; }
    th { background: #eee; }
    tr.selected td { background: #f4f4f4; font-weight: 700; }
    @media print {
      body { margin: 12mm; }
      .actions { display: none; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">Imprimir / guardar PDF</button>
  </div>

  <section class="header">
    <div>
      <h1>Reporte de avance por estacion</h1>
      <p class="muted">Historia: ${escapeHtml(data.historiaId)}</p>
      <p><strong>Estacion:</strong> ${escapeHtml(data.selectedStation.label)}</p>
      <p><strong>Estado:</strong> ${escapeHtml(data.selectedStation.status)}</p>
    </div>
    <div>
      <p><strong>Paciente:</strong> ${escapeHtml(data.paciente.nombre)}</p>
      <p><strong>Documento:</strong> ${escapeHtml(data.paciente.documento)}</p>
      <p><strong>Genero:</strong> ${escapeHtml(data.paciente.genero)}</p>
      <p><strong>Generado:</strong> ${escapeHtml(formatDateTime(data.generatedAt))}</p>
    </div>
  </section>

  <section class="stats">
    <div class="stat"><span>Estaciones requeridas</span><strong>${data.progress.required}</strong></div>
    <div class="stat"><span>Registradas</span><strong>${data.progress.completed}</strong></div>
    <div class="stat"><span>Pendientes</span><strong>${data.progress.pending}</strong></div>
  </section>

  <h2>Estaciones registradas</h2>
  <table>
    <thead>
      <tr>
        <th>Estacion</th>
        <th>Detalle corto</th>
      </tr>
    </thead>
    <tbody>
      ${data.registeredRows.length > 0 ? data.registeredRows
        .map(
          (row) => `
        <tr${row.selected ? ' class="selected"' : ""}>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.details)}</td>
        </tr>`,
        )
        .join("") : '<tr><td colspan="2">Sin estaciones registradas.</td></tr>'}
    </tbody>
  </table>

  <h2>Resumen clinico de la historia</h2>
  ${
    data.sections.length > 0
      ? data.sections
          .map(
            (section) => `
    <section class="section">
      <h3>${escapeHtml(section.title)}</h3>
      <div class="section-grid">
        ${section.items
          .filter((item) => item.value !== "Sin registro")
          .map(
            (item) => `
          <div class="item">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>`,
          )
          .join("")}
      </div>
      ${
        section.files?.length
          ? `<div class="files">
        ${section.files
          .map(
            (file) => `
          <div class="file">
            <span>${escapeHtml(file.meta)}</span>
            <a href="${escapeHtml(file.href)}">${escapeHtml(file.name)}</a>
          </div>`,
          )
          .join("")}
      </div>`
          : ""
      }
    </section>`,
          )
          .join("")
      : "<p>Sin datos clinicos registrados.</p>"
  }
</body>
</html>`;
}
