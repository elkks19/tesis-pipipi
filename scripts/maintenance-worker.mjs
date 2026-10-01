import { existsSync } from "node:fs";

import Database from "better-sqlite3";
import { Queue, Worker } from "bullmq";

const queueName = "mantenimiento";
const ragJobName = "sincronizarEmbeddings";
const sessionJobName = "limpiarSesionesExpiradas";
const auditJobName = "limpiarAuditoriaVencida";
const timezone = "America/La_Paz";

function redisConnection() {
  return { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
}

function workerLog(message, details) {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  console.log(`[${new Date().toISOString()}] [maintenance-worker] ${message}${suffix}`);
}

export async function syncEmbeddings({
  apiUrl = process.env.DATA_SCIENCE_API_URL ?? "http://localhost:8000",
  fetchImpl = fetch,
  token = process.env.DATA_SCIENCE_INTERNAL_TOKEN ?? process.env.DS_INTERNAL_TOKEN,
} = {}) {
  if (!token) {
    throw new Error("DATA_SCIENCE_INTERNAL_TOKEN debe estar configurado.");
  }

  const url = new URL("index/sync", apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`);
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(30 * 60 * 1_000),
  });

  if (!response.ok) {
    throw new Error(`La reindexación respondió HTTP ${response.status}.`);
  }

  const result = await response.json();
  return {
    historias: Number(result.historias ?? 0),
    indexedChunks: Number(result.indexed_chunks ?? 0),
    pacientes: Number(result.pacientes ?? 0),
    viajes: Number(result.viajes ?? 0),
  };
}

export function cleanupExpiredSessions({
  databasePath = process.env.BETTER_AUTH_SQLITE_PATH ?? "auth.sqlite",
  now = Date.now(),
} = {}) {
  if (!existsSync(databasePath)) {
    return { deleted: 0, skipped: "database-not-found" };
  }

  const database = new Database(databasePath);
  try {
    database.pragma("busy_timeout = 10000");
    const sessionTable = database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'session'")
      .get();
    if (!sessionTable) {
      return { deleted: 0, skipped: "session-table-not-found" };
    }

    const result = database
      .prepare("DELETE FROM session WHERE expiresAt <= ?")
      .run(now);
    return { deleted: result.changes };
  } finally {
    database.close();
  }
}

export function auditRetentionCutoff({ now = new Date(), retentionYears = 5 } = {}) {
  if (!Number.isInteger(retentionYears) || retentionYears < 1 || retentionYears > 20) {
    throw new Error("AUDIT_RETENTION_YEARS debe estar entre 1 y 20.");
  }
  const cutoff = new Date(now);
  if (!Number.isFinite(cutoff.getTime())) throw new Error("Fecha de retención inválida.");
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - retentionYears);
  return cutoff.toISOString();
}

export async function cleanupExpiredAuditLogs({
  couchUrl = process.env.COUCHDB_URL,
  fetchImpl = fetch,
  now = new Date(),
  retentionYears = Number(process.env.AUDIT_RETENTION_YEARS ?? 5),
} = {}) {
  if (!couchUrl) throw new Error("COUCHDB_URL debe estar configurado.");
  const cutoff = auditRetentionCutoff({ now, retentionYears });
  const base = new URL(couchUrl.endsWith("/") ? couchUrl : `${couchUrl}/`);
  const headers = new Headers({ "Content-Type": "application/json" });
  if (base.username || base.password) {
    headers.set("Authorization", `Basic ${Buffer.from(`${decodeURIComponent(base.username)}:${decodeURIComponent(base.password)}`).toString("base64")}`);
  }
  base.username = "";
  base.password = "";
  let deleted = 0;

  for (;;) {
    const findResponse = await fetchImpl(new URL("_find", base), {
      body: JSON.stringify({
        fields: ["_id", "_rev"],
        limit: 250,
        selector: {
          createdAt: { $lt: cutoff },
          type: { $in: ["audit_event", "agent_usage"] },
        },
      }),
      headers,
      method: "POST",
      signal: AbortSignal.timeout(30_000),
    });
    if (!findResponse.ok) throw new Error(`La consulta de retención respondió HTTP ${findResponse.status}.`);
    const page = await findResponse.json();
    const documents = Array.isArray(page.docs) ? page.docs : [];
    if (!documents.length) break;

    const deleteResponse = await fetchImpl(new URL("_bulk_docs", base), {
      body: JSON.stringify({ docs: documents.map((document) => ({ ...document, _deleted: true })) }),
      headers,
      method: "POST",
      signal: AbortSignal.timeout(30_000),
    });
    if (!deleteResponse.ok) throw new Error(`La eliminación de retención respondió HTTP ${deleteResponse.status}.`);
    const result = await deleteResponse.json();
    const failures = Array.isArray(result) ? result.filter((row) => row?.error) : [];
    if (failures.length) throw new Error(`No se pudieron eliminar ${failures.length} eventos vencidos.`);
    deleted += documents.length;
  }

  return { cutoff, deleted, retentionYears };
}

export async function startMaintenanceWorker() {
  const connection = redisConnection();
  const queue = new Queue(queueName, { connection });
  const jobOptions = {
    attempts: 5,
    backoff: { delay: 60_000, type: "exponential" },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 100 },
  };
  const ragPattern = process.env.RAG_INDEX_CRON ?? "15 */6 * * *";
  const sessionPattern = process.env.SESSION_CLEANUP_CRON ?? "15 * * * *";
  const auditPattern = process.env.AUDIT_CLEANUP_CRON ?? "30 2 * * *";

  await queue.setGlobalConcurrency(1);
  await queue.upsertJobScheduler(
    "rag-index-periodico",
    { pattern: ragPattern, tz: timezone },
    { data: {}, name: ragJobName, opts: jobOptions },
  );
  await queue.upsertJobScheduler(
    "sesiones-expiradas-periodico",
    { pattern: sessionPattern, tz: timezone },
    { data: {}, name: sessionJobName, opts: jobOptions },
  );
  await queue.upsertJobScheduler(
    "auditoria-retencion-periodica",
    { pattern: auditPattern, tz: timezone },
    { data: {}, name: auditJobName, opts: jobOptions },
  );
  await queue.add(ragJobName, {}, {
    ...jobOptions,
    jobId: "rag-index-inicial",
    removeOnComplete: true,
  });
  await queue.add(sessionJobName, {}, {
    ...jobOptions,
    jobId: "sesiones-expiradas-inicial",
    removeOnComplete: true,
  });

  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name === ragJobName) return syncEmbeddings();
      if (job.name === sessionJobName) return cleanupExpiredSessions();
      if (job.name === auditJobName) return cleanupExpiredAuditLogs();
      throw new Error(`Job de mantenimiento no soportado: ${job.name}`);
    },
    { concurrency: 1, connection },
  );

  worker.on("completed", (job, result) => {
    workerLog(`${job.name} completado`, { id: job.id, result });
  });
  worker.on("failed", (job, error) => {
    workerLog(`${job?.name ?? "job"} falló`, {
      error: error.name,
      id: job?.id,
      message: error.message,
    });
  });
  worker.on("error", (error) => workerLog("error del worker", error.message));
  queue.on("error", (error) => workerLog("error de la cola", error.message));

  workerLog("mantenimiento programado", {
    auditPattern,
    ragPattern,
    sessionPattern,
    timezone,
  });

  let closing = false;
  return {
    async close() {
      if (closing) return;
      closing = true;
      await worker.close();
      await queue.close();
    },
  };
}
