import fs from "node:fs";
import path from "node:path";

import { Worker } from "bullmq";
import carboneSdk from "carbone-sdk";
import { Disk } from "flydrive";
import { FSDriver } from "flydrive/drivers/fs";

const queueName = "reportes";
const jobName = "reporteHistoria";
const placeholderTemplateId =
  "0000000000000000000000000000000000000000000000000000000000000000";
let storageDisk = null;

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function log(message, details) {
  const timestamp = new Date().toISOString();

  if (details === undefined) {
    console.log(`[${timestamp}] [reportes-worker] ${message}`);
    return;
  }

  console.log(
    `[${timestamp}] [reportes-worker] ${message}`,
    typeof details === "string" ? details : JSON.stringify(details, null, 2),
  );
}

function logError(message, error) {
  const timestamp = new Date().toISOString();

  console.error(`[${timestamp}] [reportes-worker] ${message}`);
  console.error(error);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env"));

function getRedisConnection() {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

function hasS3Credentials() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_REGION &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

function getRequiredEnv(key) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} debe estar configurado.`);
  }

  return value;
}

function parseBoolean(value) {
  return value === "true" || value === "1";
}

function createFsDisk() {
  const location = process.env.FILE_STORAGE_ROOT ?? "storage/uploads";
  const publicUrl = process.env.FILE_STORAGE_PUBLIC_URL;

  return new Disk(
    new FSDriver({
      location,
      visibility: "private",
      urlBuilder: publicUrl
        ? {
            async generateURL(key) {
              return `${publicUrl.replace(/\/$/, "")}/${key}`;
            },
          }
        : undefined,
    }),
  );
}

async function createS3Disk() {
  const { S3Driver } = await import("flydrive/drivers/s3");

  return new Disk(
    new S3Driver({
      bucket: getRequiredEnv("S3_BUCKET"),
      region: getRequiredEnv("S3_REGION"),
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE),
      credentials: {
        accessKeyId: getRequiredEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("S3_SECRET_ACCESS_KEY"),
      },
      visibility: "private",
      supportsACL: process.env.S3_SUPPORTS_ACL
        ? parseBoolean(process.env.S3_SUPPORTS_ACL)
        : true,
      cdnUrl: process.env.S3_PUBLIC_URL,
    }),
  );
}

async function getStorageDisk() {
  if (storageDisk) {
    return storageDisk;
  }

  storageDisk = hasS3Credentials() ? await createS3Disk() : createFsDisk();

  return storageDisk;
}

function getCarboneUrl() {
  const url = process.env.CARBONE_URL;

  if (!url) {
    return undefined;
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
    log(
      "CARBONE_TLS_INSECURE activo: Node no validara el certificado TLS de Carbone.",
    );
  }
}

function getCarboneTemplate() {
  return (
    process.env.CARBONE_HISTORIA_TEMPLATE_PATH ||
    process.env.CARBONE_HISTORIA_TEMPLATE_URL ||
    process.env.CARBONE_HISTORIA_TEMPLATE_ID ||
    placeholderTemplateId
  );
}

function isCarboneV5NumericTemplateId(template) {
  return typeof template === "string" && /^\d+$/.test(template);
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getCouchUrl(pathname = "") {
  const couchDbUrl = process.env.COUCHDB_URL;

  if (!couchDbUrl) {
    throw new Error("COUCHDB_URL debe estar configurado.");
  }

  const baseUrl = couchDbUrl.endsWith("/") ? couchDbUrl : `${couchDbUrl}/`;
  const url = new URL(pathname, baseUrl);
  const headers = new Headers();

  if (url.username || url.password) {
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    );
    url.username = "";
    url.password = "";
  }

  return { headers, url };
}

async function getHistoria(historiaId) {
  const { headers, url } = getCouchUrl(encodeURIComponent(historiaId));

  log("fetching historia", {
    historiaId,
    url: url.toString(),
  });

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(
      `No se pudo obtener la historia ${historiaId}. HTTP ${response.status} ${response.statusText}. ${body}`,
      response.status,
    );
  }

  const historia = await response.json();

  log("historia loaded", {
    historiaId: historia._id,
    hasDiagnostico: Boolean(historia.diagnostico),
    pacienteId: historia.pacienteId,
    rev: historia._rev,
    viajeId: historia.viajeId,
  });

  return historia;
}

async function getPaciente(pacienteId) {
  if (!pacienteId) {
    return null;
  }

  const { headers, url } = getCouchUrl(encodeURIComponent(pacienteId));

  log("fetching paciente", {
    pacienteId,
    url: url.toString(),
  });

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `No se pudo obtener el paciente ${pacienteId}. HTTP ${response.status} ${response.statusText}. ${body}`,
    );
  }

  const paciente = await response.json();

  log("paciente loaded", {
    pacienteId: paciente._id,
    rev: paciente._rev,
  });

  return paciente;
}

function getReportFileIdentity({ generatedAt, historiaId, paciente }) {
  const dateStamp = generatedAt.replace(/[:.]/g, "-");
  const document = slugify(
    paciente?.datosPersonales?.numeroDocumentoIdentidad ?? "",
  );
  const name = slugify(getPacienteNombreCompleto(paciente));
  const historia = slugify(historiaId).slice(0, 80);
  const baseName = [
    "historia-clinica",
    document || "sin-documento",
    name || "paciente",
    dateStamp,
  ].join("-");

  return {
    fileName: `${baseName}.pdf`,
    key: `reportes/historias/${historia || "historia"}/${baseName}.pdf`,
  };
}

async function putHistoriaReportFile({ content, historia, paciente }) {
  const storage = await getStorageDisk();
  const generatedAt = new Date().toISOString();
  const { fileName, key } = getReportFileIdentity({
    generatedAt,
    historiaId: historia._id,
    paciente,
  });
  const bytes = new Uint8Array(content);

  log("saving PDF in storage", {
    bytes: bytes.byteLength,
    historiaId: historia._id,
    key,
  });

  await storage.put(key, bytes, {
    contentLength: bytes.byteLength,
    contentType: "application/pdf",
    visibility: "private",
  });

  log("PDF saved in storage", {
    historiaId: historia._id,
    key,
  });

  return {
    generatedAt,
    key,
    nombre: fileName,
    tamano: bytes.byteLength,
    tipo: "application/pdf",
    url: `/archivos/${key
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`,
  };
}

async function putCouchDocument(doc) {
  const { headers, url } = getCouchUrl(encodeURIComponent(doc._id));
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    body: JSON.stringify(doc),
    headers,
    method: "PUT",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(
      `No se pudo actualizar la historia ${doc._id}. HTTP ${response.status} ${response.statusText}. ${body}`,
      response.status,
    );
  }

  return response.json();
}

async function saveHistoriaReportReference(historiaId, reporteHistoria) {
  let currentHistoria = await getHistoria(historiaId);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const nextHistoria = {
      ...currentHistoria,
      reporteHistoria,
      reportesHistoria: [
        ...(Array.isArray(currentHistoria.reportesHistoria)
          ? currentHistoria.reportesHistoria
          : currentHistoria.reporteHistoria
            ? [currentHistoria.reporteHistoria]
            : []),
        reporteHistoria,
      ],
    };

    log("saving report reference in CouchDB", {
      attempt,
      historiaId,
      key: reporteHistoria.key,
      rev: currentHistoria._rev,
    });

    try {
      const result = await putCouchDocument(nextHistoria);

      log("report reference saved in CouchDB", result);

      return result;
    } catch (error) {
      if (error instanceof HttpError && error.status === 409 && attempt < 2) {
        log("CouchDB conflict while saving report reference, retrying", {
          historiaId,
        });
        currentHistoria = await getHistoria(historiaId);
        continue;
      }

      throw error;
    }
  }

  throw new Error(`No se pudo guardar la referencia del reporte ${historiaId}.`);
}

async function ensureDiagnosticoMatchesJob(job, step) {
  if (!job.data.diagnosticoFingerprint) {
    return true;
  }

  const currentHistoria = await getHistoria(job.data.historiaId);
  const currentFingerprint = getDiagnosticoFingerprint(
    currentHistoria.diagnostico,
  );

  if (job.data.diagnosticoFingerprint === currentFingerprint) {
    return true;
  }

  log("job skipped because diagnostico changed before saving report", {
    historiaId: job.data.historiaId,
    id: job.id,
    step,
  });

  return false;
}

function getPacienteNombreCompleto(paciente) {
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

function valueOrEmpty(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  return String(value);
}

function formatReportDate(value) {
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(value);
}

function formatDateValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return valueOrEmpty(value);
  }

  return date.toISOString().slice(0, 10);
}

function formatCieValue(value) {
  if (!value) {
    return "";
  }

  return [value.title, value.code, value.iNo].filter(Boolean).join(" - ");
}

function formatPathologicalPersonal(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return items
    .map((item) =>
      [
        formatCieValue(item.enfermedad),
        item.fechaDiagnostico
          ? `diagnosticado el ${formatDateValue(item.fechaDiagnostico)}`
          : "",
        item.tratamiento ? `tratamiento: ${item.tratamiento}` : "",
      ]
        .filter(Boolean)
        .join(", "),
    )
    .filter(Boolean)
    .join("; ");
}

function formatPathologicalFamily(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return items
    .map((item) =>
      [
        item.parentesco,
        formatCieValue(item.enfermedad),
        item.edadDiagnostico
          ? `edad diagnostico: ${item.edadDiagnostico}`
          : "",
        item.fallecimiento ? "fallecido" : "",
        item.edadFallecimiento
          ? `edad fallecimiento: ${item.edadFallecimiento}`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
    )
    .filter(Boolean)
    .join("; ");
}

function formatGinecoObstetricos(value) {
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

function buildPacienteReportData(paciente) {
  const datos = paciente?.datosPersonales ?? {};

  return {
    documento: [datos.documentoIdentidad, datos.numeroDocumentoIdentidad]
      .filter(Boolean)
      .join(" "),
    nombreCompleto: getPacienteNombreCompleto(paciente),
    fechaNacimiento: formatDateValue(datos.fechaNacimiento),
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

function buildAnamnesisReportData(anamnesis) {
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

function buildReportDataByShape({ historia, paciente, requestedBy }) {
  const examenFisicoSegmentario = historia.examenFisicoSegmentario ?? {};
  const complementarios = {
    electrocardiograma: historia.electrocardiograma ?? {},
    espirometria: historia.espirometria ?? {},
    ecografia: historia.ecografia ?? {},
    laboratorios: historia.laboratorios ?? {},
  };
  const generatedAt = new Date();
  const generatedAtIso = generatedAt.toISOString();

  return {
    metadata: {
      fechaGeneracion: generatedAtIso,
      generadoEn: generatedAtIso,
      generadoPor: valueOrEmpty(requestedBy),
      solicitadoPor: valueOrEmpty(requestedBy),
    },
    paciente: buildPacienteReportData(paciente),
    historia: {
      anamnesis: buildAnamnesisReportData(historia.anamnesis),
      examenFisicoGeneral: historia.examenFisicoGeneral ?? {},
      examenFisicoSegmentario: {
        cabeza: valueOrEmpty(examenFisicoSegmentario.cabeza),
        cuello: valueOrEmpty(examenFisicoSegmentario.cuello),
        aparatoRespiratorio: valueOrEmpty(
          examenFisicoSegmentario.aparatoRespiratorio,
        ),
        aparatoCardiovascular: valueOrEmpty(
          examenFisicoSegmentario.aparatoCardiovascular,
        ),
        abdomenPelvis: valueOrEmpty(examenFisicoSegmentario.abdomenPelvis),
        aparatoGenitoUrinario: valueOrEmpty(
          examenFisicoSegmentario.aparatoGenitourinario,
        ),
        pielFaneras: valueOrEmpty(examenFisicoSegmentario.pielFaneras),
        sistemaHemolinfopoyetico: valueOrEmpty(
          examenFisicoSegmentario.sistemaHemolinfopoyetico,
        ),
        sistemaOsteoArtroMuscular: valueOrEmpty(
          examenFisicoSegmentario.aparatoOsteoartromuscular,
        ),
        sistemaNerviosoCentral: valueOrEmpty(
          examenFisicoSegmentario.sistemaNerviosoCentral,
        ),
      },
      complementarios: {
        electrocardiograma: complementarios.electrocardiograma,
        espirometria: {
          ...complementarios.espirometria,
          observaciones: Array.isArray(
            complementarios.espirometria.observaciones,
          )
            ? complementarios.espirometria.observaciones.map((observacion) => ({
                "": observacion,
              }))
            : [],
        },
        ecografia: complementarios.ecografia,
        laboratorios: {
          ...complementarios.laboratorios,
          otrosEstudios: Array.isArray(
            complementarios.laboratorios.otrosEstudios,
          )
            ? complementarios.laboratorios.otrosEstudios
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

function buildReportData({ historia, paciente, requestedBy }) {
  return buildReportDataByShape({ historia, paciente, requestedBy });
}

function getDiagnosticoFingerprint(diagnostico) {
  if (!diagnostico) {
    return "";
  }

  return JSON.stringify({
    planTrabajo: diagnostico.planTrabajo ?? "",
    principal: diagnostico.principal ?? null,
    recetaId: diagnostico.recetaId ?? "",
    secundarios: diagnostico.secundarios ?? [],
  });
}

function isValidCarboneTemplate(template) {
  return (
    Buffer.isBuffer(template) ||
    (typeof template === "string" &&
      (isCarboneV5NumericTemplateId(template) ||
        template.length === 64 ||
        template.startsWith("http://") ||
        template.startsWith("https://") ||
        path.isAbsolute(template)))
  );
}

async function renderHistoriaReportWithCarboneV5({
  apiKey,
  carboneUrl,
  data,
  templateId,
}) {
  const renderUrl = new URL(`render/${encodeURIComponent(templateId)}`, carboneUrl);
  renderUrl.searchParams.set("download", "true");

  log("calling carbone v5 render endpoint", {
    renderUrl: renderUrl.toString(),
    templateId,
    tlsInsecure: allowInsecureCarboneTls(),
  });

  configureCarboneTls();

  const response = await fetch(renderUrl, {
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

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new Error(
      `Carbone v5 no pudo generar el reporte. HTTP ${response.status} ${response.statusText}. ${body}`,
    );
  }

  if (contentType.includes("application/json")) {
    const body = await response.text().catch(() => "");

    throw new Error(
      `Carbone v5 devolvio JSON cuando se esperaba el PDF directo. Respuesta: ${body}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function renderHistoriaReport({ historia, paciente, requestedBy }) {
  const apiKey = process.env.CARBONE_API_KEY;

  if (!apiKey) {
    throw new Error("CARBONE_API_KEY debe estar configurado.");
  }

  const carbone = carboneSdk(apiKey);
  const carboneUrl = getCarboneUrl();
  const templateId = getCarboneTemplate();

  if (!isValidCarboneTemplate(templateId)) {
    throw new Error(
      [
        "CARBONE_HISTORIA_TEMPLATE_ID no tiene formato valido para carbone-sdk.",
        "Usa un template ID numerico de Carbone v5, un ID SHA-256 de 64 caracteres,",
        "o define CARBONE_HISTORIA_TEMPLATE_URL / CARBONE_HISTORIA_TEMPLATE_PATH.",
        `Valor recibido: ${templateId}`,
      ].join(" "),
    );
  }

  if (carboneUrl) {
    carbone.setOptions({
      carboneUrl,
      isReturningBuffer: true,
    });
  }
  carbone.setApiVersion("5");

  const data = buildReportData({ historia, paciente, requestedBy });

  log("rendering report with carbone", {
    carboneUrl: carboneUrl ?? "default",
    hasApiKey: Boolean(apiKey),
    historiaId: historia._id,
    pacienteId: paciente?._id ?? null,
    solicitadoPor: requestedBy,
    templateId,
  });

  const startedAt = Date.now();

  if (isCarboneV5NumericTemplateId(templateId)) {
    const content = await renderHistoriaReportWithCarboneV5({
      apiKey,
      carboneUrl: carboneUrl ?? "https://api.carbone.io/",
      data,
      templateId,
    });

    log("carbone v5 render finished", {
      bytes: content.byteLength,
      durationMs: Date.now() - startedAt,
    });

    return content;
  }

  const result = await carbone.renderPromise(templateId, {
    convertTo: "pdf",
    data,
  });

  log("carbone render finished", {
    bytes: result.content?.byteLength ?? result.content?.length ?? 0,
    durationMs: Date.now() - startedAt,
    filename: result.filename,
  });

  return result.content;
}

// Comparte proceso y Redis con reportes, manteniendo las colas independientes.
const { startCatalogWorker } = await import("./catalogo-agemed-worker.mjs");
const catalogWorker = await startCatalogWorker();

const worker = new Worker(
  queueName,
  async (job) => {
    log("job received", {
      attemptsMade: job.attemptsMade,
      data: job.data,
      id: job.id,
      name: job.name,
    });

    if (job.name !== jobName) {
      log("job skipped due to unexpected name", {
        expected: jobName,
        received: job.name,
      });
      return { skipped: true };
    }

    await job.updateProgress({ step: "fetching-historia" });
    let historia;

    try {
      historia = await getHistoria(job.data.historiaId);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        log("job skipped because historia was not found", {
          historiaId: job.data.historiaId,
          id: job.id,
        });

        return {
          historiaId: job.data.historiaId,
          reason: "historia-not-found",
          skipped: true,
        };
      }

      throw error;
    }

    const diagnosticoFingerprint = getDiagnosticoFingerprint(historia.diagnostico);

    if (
      job.data.diagnosticoFingerprint &&
      job.data.diagnosticoFingerprint !== diagnosticoFingerprint
    ) {
      log("job skipped because diagnostico changed after enqueue", {
        historiaId: job.data.historiaId,
        id: job.id,
      });

      return {
        historiaId: job.data.historiaId,
        reason: "diagnostico-changed-after-enqueue",
        skipped: true,
      };
    }

    await job.updateProgress({ step: "fetching-paciente" });
    const paciente = await getPaciente(historia.pacienteId);
    await job.updateProgress({ step: "rendering-carbone" });
    const pdf = await renderHistoriaReport({
      historia,
      paciente,
      requestedBy: job.data.requestedByName || job.data.requestedBy,
    });

    if (!(await ensureDiagnosticoMatchesJob(job, "after-render"))) {
      return {
        historiaId: job.data.historiaId,
        reason: "diagnostico-changed-after-render",
        skipped: true,
      };
    }

    await job.updateProgress({ step: "saving-storage" });
    const reporteHistoria = await putHistoriaReportFile({
      content: pdf,
      historia,
      paciente,
    });
    await job.updateProgress({ step: "saving-reference" });
    const couchResult = await saveHistoriaReportReference(
      historia._id,
      reporteHistoria,
    );

    await job.updateProgress({ step: "done" });

    return {
      couchResult,
      historiaId: job.data.historiaId,
      reporteHistoria,
    };
  },
  {
    connection: getRedisConnection(),
  },
);

worker.on("active", (job) => {
  log("job active", {
    id: job.id,
    name: job.name,
  });
});

worker.on("completed", (job) => {
  log("job completed", {
    id: job.id,
    name: job.name,
    returnvalue: job.returnvalue,
  });
});

worker.on("failed", (job, error) => {
  logError(`job failed ${job?.name ?? "job"} ${job?.id ?? ""}`, error);
});

worker.on("progress", (job, progress) => {
  log("job progress", {
    id: job.id,
    name: job.name,
    progress,
  });
});

worker.on("ready", () => {
  log("worker ready");
});

worker.on("stalled", (jobId) => {
  log("job stalled", { jobId });
});

worker.on("error", (error) => {
  logError("worker error", error);
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  log(`${signal} received, closing workers`);
  await Promise.all([worker.close(), catalogWorker.close()]);
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

log("worker boot", {
  carboneUrl: getCarboneUrl() ?? "default",
  couchConfigured: Boolean(process.env.COUCHDB_URL),
  hasCarboneApiKey: Boolean(process.env.CARBONE_API_KEY),
  nodeExecArgv: process.execArgv,
  nodeExtraCaCerts: process.env.NODE_EXTRA_CA_CERTS ?? null,
  nodeTlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? null,
  queueName,
  redisUrl: getRedisConnection().url,
  templateId: getCarboneTemplate(),
  useSystemCa: process.execArgv.includes("--use-system-ca"),
});
