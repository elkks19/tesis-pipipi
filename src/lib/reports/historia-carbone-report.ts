import "server-only";

import { db } from "@/lib/db";
import { putFile } from "@/lib/file-storage";
import type { Historia, Paciente, ReporteHistoriaFile } from "@/lib/schema";

const placeholderTemplateId =
  "0000000000000000000000000000000000000000000000000000000000000000";

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;
type PacienteDocument = PouchDB.Core.ExistingDocument<Paciente>;

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

function getCarboneUrl() {
  const url = process.env.CARBONE_URL;

  if (!url) {
    return "https://api.carbone.io/";
  }

  return url.endsWith("/") ? url : `${url}/`;
}

function allowInsecureCarboneTls() {
  return (
    process.env.CARBONE_TLS_INSECURE === "true" ||
    process.env.CARBONE_TLS_INSECURE === "1"
  );
}

function configureCarboneTls() {
  if (!allowInsecureCarboneTls()) {
    return;
  }

  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.warn(
      "[historia-report] CARBONE_TLS_INSECURE activo: Node no validara el certificado TLS de Carbone.",
    );
  }
}

function logReportStep(message: string, details?: Record<string, unknown>) {
  console.info(
    "[historia-report]",
    message,
    details ? JSON.stringify(details) : "",
  );
}

function getCarboneTemplate() {
  return (
    process.env.CARBONE_HISTORIA_TEMPLATE_PATH ||
    process.env.CARBONE_HISTORIA_TEMPLATE_URL ||
    process.env.CARBONE_HISTORIA_TEMPLATE_ID ||
    placeholderTemplateId
  );
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function isCarboneV5NumericTemplateId(template: string) {
  return /^\d+$/.test(template);
}

function getPacienteNombreCompleto(paciente: PacienteDocument | null) {
  const datos = paciente?.datosPersonales;

  if (!datos) {
    return "";
  }

  return [
    datos.nombres,
    datos.apellidoPaterno,
    datos.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ");
}

function valueOrEmpty(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  return String(value);
}

function formatReportDate(value: Date) {
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(value);
}

function formatDateValue(value: unknown) {
  if (!value) {
    return "";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return valueOrEmpty(value);
  }

  return date.toISOString().slice(0, 10);
}

function formatCieValue(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const item = value as { code?: string; iNo?: string; title?: string };

  return [item.title, item.code, item.iNo].filter(Boolean).join(" - ");
}

function formatPathologicalPersonal(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return items
    .map((item) => {
      const value = item as {
        enfermedad?: unknown;
        fechaDiagnostico?: unknown;
        tratamiento?: string;
      };

      return [
        formatCieValue(value.enfermedad),
        value.fechaDiagnostico
          ? `diagnosticado el ${formatDateValue(value.fechaDiagnostico)}`
          : "",
        value.tratamiento ? `tratamiento: ${value.tratamiento}` : "",
      ]
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean)
    .join("; ");
}

function formatPathologicalFamily(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return items
    .map((item) => {
      const value = item as {
        edadDiagnostico?: number;
        edadFallecimiento?: number;
        enfermedad?: unknown;
        fallecimiento?: boolean;
        parentesco?: string;
      };

      return [
        value.parentesco,
        formatCieValue(value.enfermedad),
        value.edadDiagnostico
          ? `edad diagnostico: ${value.edadDiagnostico}`
          : "",
        value.fallecimiento ? "fallecido" : "",
        value.edadFallecimiento
          ? `edad fallecimiento: ${value.edadFallecimiento}`
          : "",
      ]
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean)
    .join("; ");
}

function formatGinecoObstetricos(value: NonNullable<
  Historia["anamnesis"]
>["antecedentesGinecoObstetricos"]) {
  if (!value) {
    return "";
  }

  return [
    value.estadioTanner ? `Tanner: ${value.estadioTanner}` : "",
    value.menarca ? `menarca: ${value.menarca}` : "",
    value.ritmoMenstrual ? `ritmo menstrual: ${value.ritmoMenstrual}` : "",
    `gestaciones: ${valueOrEmpty(value.gestaciones)}`,
    `partos: ${valueOrEmpty(value.partos)}`,
    `abortos: ${valueOrEmpty(value.abortos)}`,
    `cesareas: ${valueOrEmpty(value.cesareas)}`,
    value.terapiaAnticonceptiva !== undefined
      ? `terapia anticonceptiva: ${valueOrEmpty(value.terapiaAnticonceptiva)}`
      : "",
    value.metodoAnticonceptivo
      ? `metodo: ${value.metodoAnticonceptivo}`
      : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function buildPacienteReportData(paciente: PacienteDocument | null) {
  const datos = paciente?.datosPersonales;

  return {
    documento: [datos?.documentoIdentidad, datos?.numeroDocumentoIdentidad]
      .filter(Boolean)
      .join(" "),
    nombreCompleto: getPacienteNombreCompleto(paciente),
    fechaNacimiento: formatDateValue(datos?.fechaNacimiento),
    genero: valueOrEmpty(paciente?.genero),
    nacionalidad: valueOrEmpty(paciente?.nacionalidad),
    etnia: valueOrEmpty(paciente?.etnia),
    lugarNacimiento: {
      pais: valueOrEmpty(paciente?.lugarNacimiento?.pais),
      departamento: valueOrEmpty(paciente?.lugarNacimiento?.departamento),
      distrito: valueOrEmpty(paciente?.lugarNacimiento?.distrito),
    },
  };
}

function buildAnamnesisReportData(anamnesis: Historia["anamnesis"]) {
  return {
    estadoCivil: valueOrEmpty(anamnesis?.estadoCivil),
    nivelEducativo: valueOrEmpty(anamnesis?.nivelEducativo),
    anosCursados: valueOrEmpty(anamnesis?.añosCursados),
    situacionLaboral: valueOrEmpty(anamnesis?.situacionLaboral),
    motivoConsulta: valueOrEmpty(anamnesis?.motivoConsulta),
    historiaEnfermedadActual: valueOrEmpty(
      anamnesis?.historiaEnfermedadActual,
    ),
    antecedentesGinecoObstetricos: formatGinecoObstetricos(
      anamnesis?.antecedentesGinecoObstetricos,
    ),
    antecedentesNoPatologicos: {
      habitoTabaquico: valueOrEmpty(
        anamnesis?.antecedentesNoPatologicos?.habitoTabaquico,
      ),
      consumoAlcohol: valueOrEmpty(
        anamnesis?.antecedentesNoPatologicos?.consumoAlcohol,
      ),
      realizaActividadFisica: valueOrEmpty(
        anamnesis?.antecedentesNoPatologicos?.realizaActividadFisica,
      ),
      consumoFrutasVerduras: valueOrEmpty(
        anamnesis?.antecedentesNoPatologicos?.consumoFrutasVerduras,
      ),
    },
    antecedentesPatologicos: {
      personales: formatPathologicalPersonal(
        anamnesis?.antecedentesPatologicos?.personales,
      ),
      familiares: formatPathologicalFamily(
        anamnesis?.antecedentesPatologicos?.familiares,
      ),
    },
  };
}

export function buildHistoriaCarboneReportData({
  historia,
  paciente,
  solicitadoPor,
}: {
  historia: HistoriaDocument;
  paciente: PacienteDocument | null;
  solicitadoPor: string;
}) {
  const examenFisicoSegmentario = historia.examenFisicoSegmentario;
  const electrocardiograma = historia.electrocardiograma ?? {};
  const espirometria = historia.espirometria;
  const ecografia = historia.ecografia ?? {};
  const laboratorios = historia.laboratorios;
  const generatedAt = new Date();
  const generatedAtIso = generatedAt.toISOString();

  return {
    metadata: {
      fechaGeneracion: generatedAtIso,
      generadoEn: generatedAtIso,
      generadoPor: solicitadoPor,
      solicitadoPor,
    },
    paciente: buildPacienteReportData(paciente),
    historia: {
      anamnesis: buildAnamnesisReportData(historia.anamnesis),
      examenFisicoGeneral: historia.examenFisicoGeneral ?? {},
      examenFisicoSegmentario: {
        cabeza: valueOrEmpty(examenFisicoSegmentario?.cabeza),
        cuello: valueOrEmpty(examenFisicoSegmentario?.cuello),
        aparatoRespiratorio: valueOrEmpty(
          examenFisicoSegmentario?.aparatoRespiratorio,
        ),
        aparatoCardiovascular: valueOrEmpty(
          examenFisicoSegmentario?.aparatoCardiovascular,
        ),
        abdomenPelvis: valueOrEmpty(examenFisicoSegmentario?.abdomenPelvis),
        aparatoGenitoUrinario: valueOrEmpty(
          examenFisicoSegmentario?.aparatoGenitourinario,
        ),
        pielFaneras: valueOrEmpty(examenFisicoSegmentario?.pielFaneras),
        sistemaHemolinfopoyetico: valueOrEmpty(
          examenFisicoSegmentario?.sistemaHemolinfopoyetico,
        ),
        sistemaOsteoArtroMuscular: valueOrEmpty(
          examenFisicoSegmentario?.aparatoOsteoartromuscular,
        ),
        sistemaNerviosoCentral: valueOrEmpty(
          examenFisicoSegmentario?.sistemaNerviosoCentral,
        ),
      },
      complementarios: {
        electrocardiograma,
        espirometria: {
          ...espirometria,
          observaciones: Array.isArray(espirometria?.observaciones)
            ? espirometria.observaciones.map((observacion) => ({
                "": observacion,
              }))
            : [],
        },
        ecografia,
        laboratorios: {
          ...laboratorios,
          otrosEstudios: Array.isArray(laboratorios?.otrosEstudios)
            ? laboratorios.otrosEstudios
            : [],
        },
      },
      diagnostico: {
        planTrabajo: valueOrEmpty(historia.diagnostico?.planTrabajo),
        principal: {
          title: valueOrEmpty(historia.diagnostico?.principal?.title),
        },
        secundarios: Array.isArray(historia.diagnostico?.secundarios)
          ? historia.diagnostico.secundarios.map((diagnostico) => ({
              title: valueOrEmpty(diagnostico.title),
            }))
          : [],
      },
    },
  };
}

function getReportFileIdentity({
  generatedAt,
  historiaId,
  paciente,
  versioned,
}: {
  generatedAt: string;
  historiaId: string;
  paciente: PacienteDocument | null;
  versioned: boolean;
}) {
  const dateStamp = generatedAt.replace(/[:.]/g, "-");
  const document = slugify(
    paciente?.datosPersonales.numeroDocumentoIdentidad ?? "",
  );
  const name = slugify(getPacienteNombreCompleto(paciente));
  const historia = slugify(historiaId).slice(0, 80);
  const baseName = versioned
    ? [
        "historia-clinica",
        document || "sin-documento",
        name || "paciente",
        dateStamp,
      ].join("-")
    : [
        "historia-clinica",
        document || "sin-documento",
        name || "paciente",
        "actual",
      ].join("-");

  return {
    fileName: `${baseName}.pdf`,
    key: `reportes/historias/${historia || "historia"}/${baseName}.pdf`,
  };
}

async function renderWithCarboneV5(data: unknown) {
  const apiKey = process.env.CARBONE_API_KEY;
  const templateId = getCarboneTemplate();

  if (!apiKey) {
    throw new Error("CARBONE_API_KEY debe estar configurado.");
  }

  if (!isCarboneV5NumericTemplateId(templateId)) {
    throw new Error(
      "CARBONE_HISTORIA_TEMPLATE_ID debe ser el ID numerico de Carbone v5.",
    );
  }

  const renderUrl = new URL(
    `render/${encodeURIComponent(templateId)}`,
    getCarboneUrl(),
  );
  renderUrl.searchParams.set("download", "true");

  logReportStep("rendering with carbone", {
    tlsInsecure: allowInsecureCarboneTls(),
    renderUrl: renderUrl.toString(),
    templateId,
  });

  let response: Response;

  try {
    configureCarboneTls();

    response = await fetch(renderUrl, {
      body: JSON.stringify({
        convertTo: "pdf",
        data,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "carbone-version": "5",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    console.error("[historia-report] carbone fetch failed", error);
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new Error(
      `Carbone v5 no pudo generar el reporte. HTTP ${response.status} ${response.statusText}. ${body}`,
    );
  }

  const pdf = new Uint8Array(await response.arrayBuffer());

  logReportStep("carbone rendered PDF", {
    bytes: pdf.byteLength,
  });

  return pdf;
}

async function getHistoriaWithPaciente(historiaId: string) {
  logReportStep("loading historia", { historiaId });

  const historia = await db.get(historiaId).catch(() => null);

  if (!isHistoria(historia)) {
    logReportStep("historia not found", { historiaId });
    return null;
  }

  const paciente = await db
    .get(historia.pacienteId)
    .then((doc) => (isPaciente(doc) ? doc : null))
    .catch(() => null);

  logReportStep("historia loaded", {
    hasPaciente: Boolean(paciente),
    historiaId,
    pacienteId: historia.pacienteId,
  });

  return {
    historia,
    paciente,
  };
}

async function saveReportReference({
  historiaId,
  reporteHistoria,
  trackHistory,
}: {
  historiaId: string;
  reporteHistoria: ReporteHistoriaFile;
  trackHistory: boolean;
}) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const current = await db.get(historiaId);

    if (!isHistoria(current)) {
      throw new Error("La historia no existe.");
    }

    try {
      logReportStep("saving report reference", {
        attempt,
        historiaId,
        key: reporteHistoria.key,
      });

      return await db.put({
        ...current,
        reporteHistoria,
        ...(trackHistory
          ? {
              reportesHistoria: [
                ...(Array.isArray(current.reportesHistoria)
                  ? current.reportesHistoria
                  : current.reporteHistoria
                    ? [current.reporteHistoria]
                    : []),
                reporteHistoria,
              ],
            }
          : {}),
      });
    } catch (error) {
      if (
        attempt < 2 &&
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 409
      ) {
        continue;
      }

      throw error;
    }
  }
}

export async function generateHistoriaCarboneReport({
  historiaId,
  storageMode = "versioned",
  solicitadoPor,
}: {
  historiaId: string;
  storageMode?: "latest" | "versioned";
  solicitadoPor: string;
}) {
  const result = await getHistoriaWithPaciente(historiaId);

  if (!result) {
    return null;
  }

  const data = buildHistoriaCarboneReportData({
    historia: result.historia,
    paciente: result.paciente,
    solicitadoPor,
  });
  const pdf = await renderWithCarboneV5(data);
  const generatedAt = new Date().toISOString();
  const { fileName, key } = getReportFileIdentity({
    generatedAt,
    historiaId,
    paciente: result.paciente,
    versioned: storageMode === "versioned",
  });

  logReportStep("saving PDF in storage", {
    fileName,
    key,
    storageMode,
  });

  await putFile({
    bytes: pdf,
    contentType: "application/pdf",
    key,
  });

  const reporteHistoria = {
    generatedAt,
    key,
    nombre: fileName,
    tamano: pdf.byteLength,
    tipo: "application/pdf",
    url: `/archivos/${key
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`,
  };

  await saveReportReference({
    historiaId,
    reporteHistoria,
    trackHistory: storageMode === "versioned",
  });

  return {
    file: reporteHistoria,
    pdf: Buffer.from(pdf),
  };
}
