import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { Queue, Worker } from "bullmq";
import ExcelJS from "exceljs";
import PouchDB from "pouchdb";

try {
  process.loadEnvFile?.(".env");
} catch {
  // Production environments generally inject variables directly.
}

const queueName = "catalogo-medicamentos";
const jobName = "actualizarCatalogoAgemed";
const sourcePage = process.env.AGEMED_CATALOG_URL ?? "https://apiwww.agemed.gob.bo/api/listautcom";
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

function text(value) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function key(value) {
  return text(value)?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

const aliases = {
  atcCode: ["atc", "codigoatc", "clasificacionatq"],
  concentracion: ["concentraci"],
  formaFarmaceutica: ["formafarmac", "forma"],
  laboratorio: ["laboratorio", "fabricante"],
  nombreComercial: ["nombrecomercial", "marca"],
  principioActivo: ["principioactivo", "dci", "nombregenerico", "medicamento"],
  registroSanitario: ["registrosanitario", "nroregistrosanitario", "numeroregistrosanitario", "registro"],
  titularRegistro: ["titularregistro", "titular", "empresa"],
  viaAdministracion: ["viadeadministracion", "via"],
};

function mapColumns(headers) {
  const normalized = headers.map(key);
  return Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, normalized.findIndex((header) => names.some((name) => header === name || header.startsWith(name))) ]));
}

function field(row, index) {
  return index >= 0 ? text(row[index]) : undefined;
}

function chunks(values, size = 500) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function parseCsv(content) {
  const rows = content.split(/\r?\n/).filter(Boolean).map((line) => {
    const values = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if ((character === "," || character === ";") && !quoted) { values.push(value); value = ""; }
      else value += character;
    }
    values.push(value);
    return values;
  });
  return rows;
}

export async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo XLSX no contiene hojas.");
  const rows = [];
  sheet.eachRow((row) => rows.push(row.values.slice(1).map((value) => typeof value === "object" && value && "text" in value ? value.text : value)));
  return rows;
}

async function downloadSource() {
  const response = await fetch(sourcePage, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`AGEMED respondio ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return { buffer: Buffer.from(await response.arrayBuffer()), contentType, url: sourcePage };
  const html = await response.text();
  const links = [...html.matchAll(/href=["']([^"']+\.(?:xlsx|csv))(?:\?[^"']*)?["']/gi)].map((match) => {
    if (/^https?:/i.test(match[1])) return match[1];
    return new URL(match[1].replace(/^\//, ""), "https://www.agemed.gob.bo/").toString();
  });
  if (!links[0]) throw new Error("AGEMED no publico un enlace CSV/XLSX reconocible.");
  const fileResponse = await fetch(links[0], { signal: AbortSignal.timeout(60_000) });
  if (!fileResponse.ok) throw new Error(`No se pudo descargar el listado oficial (${fileResponse.status}).`);
  return { buffer: Buffer.from(await fileResponse.arrayBuffer()), contentType: fileResponse.headers.get("content-type") ?? "", url: links[0] };
}

export async function importCatalog(database, loadSource = downloadSource) {
  const startedAt = new Date().toISOString();
  const importId = `importacionCatalogo:${startedAt}:${randomUUID()}`;
  try {
    const source = await loadSource();
    const isXlsx = source.url.toLowerCase().includes(".xlsx") || source.contentType.includes("spreadsheetml");
    const isCsv = source.url.toLowerCase().includes(".csv") || source.contentType.includes("csv");
    if (!isXlsx && !isCsv) throw new Error(`Formato no soportado: ${source.contentType || source.url}`);
    const rows = isXlsx ? await parseWorkbook(source.buffer) : parseCsv(source.buffer.toString("utf8"));
    const headerIndex = rows.findIndex((row) => row.some((cell) => key(cell).startsWith("registro")) && row.some((cell) => aliases.principioActivo.includes(key(cell))));
    if (headerIndex < 0) throw new Error("No se reconocieron las columnas obligatorias de AGEMED.");
    const columns = mapColumns(rows[headerIndex]);
    const registrationColumns = rows[headerIndex].map((cell, index) => key(cell).startsWith("registro") ? index : -1).filter((index) => index >= 0);
    const parsed = rows.slice(headerIndex + 1).map((row) => {
      const item = Object.fromEntries(Object.keys(aliases).map((name) => [name, field(row, columns[name])]));
      if (registrationColumns.length >= 2) {
        const prefix = field(row, registrationColumns[0]);
        const number = field(row, registrationColumns[1]);
        const dateValue = field(row, registrationColumns[2]);
        const year = dateValue?.match(/(20\d{2})/)?.[1];
        item.registroSanitario = [prefix, number].filter(Boolean).join("-") + (year ? `/${year}` : "");
      }
      return item;
    }).filter((item) => item.principioActivo && item.registroSanitario);
    if (parsed.length === 0) throw new Error("El listado no contiene medicamentos validos.");
    const candidates = [...new Map(parsed.map((item) => {
      const hash = createHash("sha1").update(`${key(item.registroSanitario)}|${key(item.principioActivo)}|${key(item.concentracion)}|${key(item.formaFarmaceutica)}`).digest("hex").slice(0, 18);
      const id = `medicamentoCatalogo:agemed:${hash}`;
      return [id, { id, item }];
    })).values()];
    const importedIds = new Set(candidates.map(({ id }) => id));
    const existingRows = [];
    for (const batch of chunks(candidates.map(({ id }) => id))) {
      const response = await database.allDocs({ include_docs: true, keys: batch });
      existingRows.push(...response.rows);
    }
    const existingById = new Map(existingRows.flatMap((row) => row.doc ? [[row.id, row.doc]] : []));
    const docs = candidates.map(({ id, item }) => {
      const existing = existingById.get(id);
      return { ...item, _id: id, ...(existing?._rev ? { _rev: existing._rev } : {}), createdAt: existing?.createdAt ?? startedAt, createdBy: existing?.createdBy, fuente: "agemed", fuenteActualizadaAt: startedAt, id, importacionId: importId, registroVigente: true, type: "medicamentoCatalogo", updatedAt: startedAt, updatedBy: "system:agemed" };
    });
    // No retirar registros anteriores si la carga nueva tuvo errores.
    const results = [];
    for (const batch of chunks(docs)) results.push(...await database.bulkDocs(batch));
    const errors = results.filter((result) => "error" in result);
    if (errors.length) throw new Error(`Fallaron ${errors.length} medicamentos; se reintentara la importacion.`);
    const omitted = rows.length - headerIndex - 1 - parsed.length;
    const retired = [];
    const previous = await database.allDocs({ include_docs: true, startkey: "medicamentoCatalogo:agemed:", endkey: "medicamentoCatalogo:agemed:\ufff0" });
    for (const row of previous.rows) {
      if (omitted === 0 && row.doc && !importedIds.has(row.id) && row.doc.registroVigente !== false) {
        retired.push({ ...row.doc, fuenteActualizadaAt: startedAt, importacionId: importId, registroVigente: false, updatedAt: startedAt, updatedBy: "system:agemed" });
      }
    }
    for (const batch of chunks(retired)) {
      const results = await database.bulkDocs(batch);
      if (results.some((result) => "error" in result)) throw new Error("No se pudo actualizar la vigencia del catalogo completo.");
    }
    await database.put({ _id: importId, createdAt: startedAt, errores: [], estado: "completada", fuenteUrl: source.url, id: importId, importados: candidates.length, omitidos: omitted, type: "importacionCatalogo", updatedAt: new Date().toISOString() });
    return { imported: candidates.length, omitted, retired: retired.length };
  } catch (error) {
    await database.put({ _id: importId, createdAt: startedAt, errores: [error instanceof Error ? error.message : String(error)], estado: "fallida", fuenteUrl: sourcePage, id: importId, importados: 0, omitidos: 0, type: "importacionCatalogo", updatedAt: new Date().toISOString() });
    throw error;
  }
}

export async function startCatalogWorker() {
  if (!process.env.COUCHDB_URL) throw new Error("COUCHDB_URL debe estar configurado.");
  const database = new PouchDB(process.env.COUCHDB_URL);
  const queue = new Queue(queueName, { connection });
  const options = {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 100 },
  };
  const pattern = process.env.AGEMED_CATALOG_CRON ?? "0 3 * * *";
  await queue.setGlobalConcurrency(1);
  await queue.upsertJobScheduler("agemed-diario", { pattern, tz: "America/La_Paz" }, { name: jobName, data: {}, opts: options });
  // ID fijo evita encolar varias cargas iniciales si arrancan varias instancias.
  await queue.add(jobName, {}, { ...options, jobId: "agemed-inicial", removeOnComplete: true, removeOnFail: true });

  const worker = new Worker(queueName, async (job) => {
    if (job.name !== jobName) throw new Error(`Job no soportado: ${job.name}`);
    return importCatalog(database);
  }, { connection, concurrency: 1 });

  console.log(`[catalogo-agemed] Carga inicial encolada; cron ${pattern} (America/La_Paz).`);
  worker.on("completed", (job, result) => console.log(`[catalogo-agemed] ${job.id} completado`, result));
  worker.on("failed", (job, error) => console.error(`[catalogo-agemed] ${job?.id ?? "desconocido"} fallo`, error.message));
  worker.on("error", (error) => console.error("[catalogo-agemed] Worker", error.message));
  queue.on("error", (error) => console.error("[catalogo-agemed] Cola", error.message));

  let closing = false;
  async function shutdown() {
    if (closing) return;
    closing = true;
    await worker.close();
    await queue.close();
    await database.close();
  }
  return { worker, close: shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--once")) {
    if (!process.env.COUCHDB_URL) throw new Error("COUCHDB_URL debe estar configurado.");
    const database = new PouchDB(process.env.COUCHDB_URL);
    try {
      console.log("[catalogo-agemed] Importacion completada", await importCatalog(database));
    } finally {
      await database.close();
    }
  } else {
    const catalog = await startCatalogWorker();
    process.on("SIGINT", catalog.close);
    process.on("SIGTERM", catalog.close);
  }
}
