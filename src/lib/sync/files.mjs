import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Disk } from 'flydrive';
import { FSDriver } from 'flydrive/drivers/fs';
import { syncConfig } from './config.mjs';
import { allDocuments, controlGet, controlPut, controlList, remote } from './couch.mjs';

export function validFileKey(key) {
  return typeof key === 'string' && key.length > 0 && key.length < 1024 && !key.startsWith('/') && !key.includes('\\') && !key.includes('\0') && key.split('/').every((part) => part && part !== '.' && part !== '..') && !key.startsWith('.sync-');
}
export async function syncDisk() {
  if (syncConfig().environment === 'raspberry' || !process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID) return new Disk(new FSDriver({ location: process.env.FILE_STORAGE_ROOT || 'storage/uploads', visibility: 'private' }));
  const { S3Driver } = await import('flydrive/drivers/s3');
  return new Disk(new S3Driver({ bucket: process.env.S3_BUCKET, region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT, forcePathStyle: ['true', '1'].includes(process.env.S3_FORCE_PATH_STYLE), credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }, visibility: 'private', supportsACL: process.env.S3_SUPPORTS_ACL !== 'false' }));
}
export function referencedFiles(docs) {
  const keys = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (validFileKey(value.key) && (typeof value.tamano === 'number' || typeof value.tipo === 'string')) keys.add(value.key);
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
  }
  for (const doc of docs) visit(doc);
  return [...keys].sort();
}
export async function fileInfo(key, disk) {
  if (!validFileKey(key)) throw new Error('Clave de archivo inválida.');
  if (!await disk.exists(key)) return { key, missing: true };
  let size = 0; const hash = createHash('sha256');
  for await (const chunk of await disk.getStream(key)) { size += chunk.length; hash.update(chunk); }
  return { key, size, sha256: hash.digest('hex'), missing: false };
}
export async function fileManifest() {
  const disk = await syncDisk(); const results = [];
  for (const key of referencedFiles(await allDocuments())) results.push(await fileInfo(key, disk));
  return results;
}
/** @param {string | undefined} [replaceHash] */
export async function verifiedReceive(key, stream, expected, disk = undefined, replaceHash = undefined) {
  if (!validFileKey(key) || !/^[a-f0-9]{64}$/.test(expected.sha256) || !Number.isSafeInteger(expected.size) || expected.size < 0) throw new Error('Metadatos de archivo inválidos.');
  disk ??= await syncDisk();
  const tempRoot = join(tmpdir(), 'tesis-sync'); await mkdir(tempRoot, { recursive: true, mode: 0o700 });
  const temp = join(tempRoot, randomUUID());
  let size = 0; const hash = createHash('sha256');
  try {
    await pipeline(stream, new Transform({ transform(chunk, _encoding, callback) { size += chunk.length; if (size > expected.size) { callback(new Error('Tamaño excedido.')); return; } hash.update(chunk); callback(null, chunk); } }), createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
    if (size !== expected.size || hash.digest('hex') !== expected.sha256) throw new Error('Archivo incompleto o checksum incorrecto.');
    const current = await fileInfo(key, disk);
    if (!current.missing && current.sha256 === expected.sha256) return { ok: true };
    if (replaceHash && current.sha256 !== replaceHash) throw new Error('El archivo cambió mientras se resolvía.');
    if (!current.missing && replaceHash) {
      await disk.putStream(`sync-conflicts/${current.sha256}`, await disk.getStream(key), { visibility: 'private', contentLength: current.size });
    }
    if (!current.missing && !replaceHash) {
      const id = `file-conflict:${createHash('sha256').update(key).digest('hex')}`;
      const candidateKey = `sync-conflicts/${expected.sha256}`;
      await disk.putStream(candidateKey, createReadStream(temp), { visibility: 'private', contentLength: size });
      const previous = await controlGet(id);
      await controlPut({ ...previous, _id: id, key, current, candidate: { ...expected, key: candidateKey }, resolved: false, updatedAt: new Date().toISOString() });
      return { ok: false, conflict: true };
    }
    if (syncConfig().environment === 'raspberry' || !process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID) {
      const target = resolve(process.env.FILE_STORAGE_ROOT || 'storage/uploads', key);
      const { dirname } = await import('node:path'); await mkdir(dirname(target), { recursive: true });
      // Staging is on the destination filesystem, so publish is an atomic rename.
      const stage = `${target}.sync-${randomUUID()}`;
      try { await pipeline(createReadStream(temp), createWriteStream(stage, { flags: 'wx', mode: 0o600 })); await rename(stage, target); }
      finally { await unlink(stage).catch(() => {}); }
    } else await disk.putStream(key, createReadStream(temp), { visibility: 'private', contentLength: size });
    return { ok: true };
  } finally { await unlink(temp).catch(() => {}); }
}
export async function synchronizeFiles() {
  const local = await fileManifest();
  const cloud = await (await remote('files')).json();
  const resolutions = await (await remote('file-resolutions')).json();
  const localMap = new Map(local.map((item) => [item.key, item]));
  const cloudMap = new Map(cloud.map((item) => [item.key, item]));
  const disk = await syncDisk(); let transferred = 0; let pending = 0; let conflicts = 0;
  for (const key of new Set([...localMap.keys(), ...cloudMap.keys()])) {
    const a = localMap.get(key); const b = cloudMap.get(key);
    if (a?.sha256 && a.sha256 === b?.sha256) continue;
    if (!a?.sha256 && !b?.sha256) { pending++; continue; }
    const resolution = resolutions.find((item) => item.key === key && item.selectedHash === b?.sha256 && item.rejectedHashes?.includes(a?.sha256));
    if (a?.sha256 && b?.sha256 && resolution) {
      const response = await remote(`file?key=${encodeURIComponent(key)}`);
      await verifiedReceive(key, Readable.fromWeb(response.body), b, disk, a.sha256);
      transferred++; continue;
    }
    // A file may arrive before its document. Wait for replication instead of aborting the entire batch on 404.
    if (!a || !b) { pending++; continue; }
    if (a?.sha256 && b?.sha256) { conflicts++; }
    if (a?.sha256) {
      const response = await remote(`file?key=${encodeURIComponent(key)}`, { method: 'PUT', body: await disk.getStream(key), stream: true, headers: { 'X-File-Sha256': a.sha256, 'X-File-Size': String(a.size) } });
      const outcome = await response.json(); if (outcome.ok) transferred++; else pending++;
    } else {
      const response = await remote(`file?key=${encodeURIComponent(key)}`);
      const outcome = await verifiedReceive(key, Readable.fromWeb(response.body), b, disk);
      if (outcome.ok) transferred++; else pending++;
    }
  }
  return { transferred, pending, conflicts, updatedAt: new Date().toISOString() };
}

export async function resolveFileConflict(id, selected, expected, actorId) {
  if (syncConfig().environment !== 'cloud') throw new Error('Resuelve los archivos desde la nube.');
  if (typeof id !== 'string' || !id.startsWith('file-conflict:') || !['current', 'candidate'].includes(selected)) throw new Error('Selección inválida.');
  const doc = await controlGet(id);
  if (!doc || doc.resolved || JSON.stringify(expected) !== JSON.stringify([doc.current.sha256, doc.candidate.sha256])) throw new Error('El conflicto cambió. Actualiza la comparación.');
  const disk = await syncDisk();
  const current = await fileInfo(doc.key, disk);
  if (current.sha256 !== doc.current.sha256) throw new Error('El archivo actual cambió.');
  const chosen = doc[selected];
  const auditId = `file-resolution:${randomUUID()}`;
  await controlPut({ _id: auditId, conflictId: id, key: doc.key, selected, current: doc.current, candidate: doc.candidate, actorId, state: 'pending', createdAt: new Date().toISOString() });
  if (selected === 'candidate') await verifiedReceive(doc.key, await disk.getStream(doc.candidate.key), doc.candidate, disk, current.sha256);
  const latest = await controlGet(id);
  if (latest._rev !== doc._rev) throw new Error('Llegó una nueva revisión del archivo; revisa el conflicto nuevamente.');
  await controlPut({ ...latest, resolved: true, selectedHash: chosen.sha256, rejectedHashes: [doc.current.sha256, doc.candidate.sha256].filter((hash) => hash !== chosen.sha256), actorId, resolvedAt: new Date().toISOString() });
  const audit = await controlGet(auditId); await controlPut({ ...audit, state: 'completed' });
  return { ok: true };
}
export async function fileResolutions() {
  return (await controlList('file-conflict:')).filter((doc) => doc.resolved).map(({ key, selectedHash, rejectedHashes }) => ({ key, selectedHash, rejectedHashes }));
}
