import fs from "node:fs";
import path from "node:path";

import { Worker } from "bullmq";
import carboneSdk from "carbone-sdk";

const queueName = "reportes";
const jobName = "reporteHistoria";
const placeholderTemplateId =
  "0000000000000000000000000000000000000000000000000000000000000000";

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

function getCarboneUrl() {
  const url = process.env.CARBONE_URL;

  if (!url) {
    return undefined;
  }

  return url.endsWith("/") ? url : `${url}/`;
}

function getCarboneTemplate() {
  return process.env.CARBONE_HISTORIA_TEMPLATE_ID ?? placeholderTemplateId;
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
  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`No se pudo obtener la historia ${historiaId}.`);
  }

  return response.json();
}

async function putHistoriaAttachment(historia, content) {
  const attachmentName = "reporte-historia.pdf";
  const { headers, url } = getCouchUrl(
    `${encodeURIComponent(historia._id)}/${attachmentName}`,
  );
  url.searchParams.set("rev", historia._rev);
  headers.set("Content-Type", "application/pdf");

  const response = await fetch(url, {
    body: new Uint8Array(content),
    headers,
    method: "PUT",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`No se pudo guardar el reporte: ${message}`);
  }

  return response.json();
}

async function renderHistoriaReport(historia) {
  const apiKey = process.env.CARBONE_API_KEY;

  if (!apiKey) {
    throw new Error("CARBONE_API_KEY debe estar configurado.");
  }

  const carbone = carboneSdk(apiKey);
  const carboneUrl = getCarboneUrl();

  if (carboneUrl) {
    carbone.setOptions({
      carboneUrl,
      isReturningBuffer: true,
    });
  }

  const result = await carbone.renderPromise(getCarboneTemplate(), {
    convertTo: "pdf",
    data: {
      generadoEn: new Date().toISOString(),
      historia,
    },
  });

  return result.content;
}

const worker = new Worker(
  queueName,
  async (job) => {
    if (job.name !== jobName) {
      return { skipped: true };
    }

    const historia = await getHistoria(job.data.historiaId);
    const pdf = await renderHistoriaReport(historia);
    const attachment = await putHistoriaAttachment(historia, pdf);

    return {
      attachment,
      historiaId: job.data.historiaId,
    };
  },
  {
    connection: getRedisConnection(),
  },
);

worker.on("completed", (job) => {
  console.log(`completed ${job.name} ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`failed ${job?.name ?? "job"} ${job?.id ?? ""}`);
  console.error(error);
});

worker.on("error", (error) => {
  console.error(error);
});

console.log(`reporte historia worker listening on ${queueName}`);
