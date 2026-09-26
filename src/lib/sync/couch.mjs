import { syncConfig } from './config.mjs';

export class SyncHttpError extends Error {
  constructor(status) { super(`Servicio de datos: HTTP ${status}.`); this.status = status; }
}
export async function couch(path = '', { method = 'GET', body, server = false, missing = false } = {}) {
  const { localUrl } = syncConfig();
  const base = new URL(localUrl.endsWith('/') ? localUrl : `${localUrl}/`);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (base.username || base.password) headers.set('Authorization', `Basic ${Buffer.from(`${decodeURIComponent(base.username)}:${decodeURIComponent(base.password)}`).toString('base64')}`);
  base.username = ''; base.password = '';
  if (server) base.pathname = '/';
  const response = await fetch(new URL(path, base), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000), cache: 'no-store' });
  if (response.status === 404 && missing) return null;
  if (!response.ok) throw new SyncHttpError(response.status);
  return response.json();
}
export async function controlGet(id) {
  return couch(`${encodeURIComponent(syncConfig().controlDb)}/${encodeURIComponent(id)}`, { server: true, missing: true });
}
export async function controlPut(doc) {
  return couch(`${encodeURIComponent(syncConfig().controlDb)}/${encodeURIComponent(doc._id)}`, { server: true, method: 'PUT', body: doc });
}
export async function ensureControl() {
  try { await couch(encodeURIComponent(syncConfig().controlDb), { server: true, method: 'PUT' }); }
  catch (error) { if (!(error instanceof SyncHttpError) || error.status !== 412) throw error; }
  // Same credentials as local database, never an anonymously readable control store.
  const security = await couch('_security');
  const url = new URL(syncConfig().localUrl);
  const username = decodeURIComponent(url.username);
  if (!username) throw new Error('La base de control requiere credenciales locales explícitas.');
  await couch(`${encodeURIComponent(syncConfig().controlDb)}/_security`, { server: true, method: 'PUT', body: { admins: security.admins ?? { names: [], roles: [] }, members: { names: [username], roles: [] } } });
}
export async function controlList(prefix) {
  const db = encodeURIComponent(syncConfig().controlDb);
  const result = await couch(`${db}/_all_docs?include_docs=true&startkey=${encodeURIComponent(JSON.stringify(prefix))}&endkey=${encodeURIComponent(JSON.stringify(prefix + '\ufff0'))}`, { server: true, missing: true });
  return result?.rows.map((row) => row.doc).filter(Boolean) ?? [];
}
export async function allDocuments() {
  const docs = []; let start;
  for (;;) {
    const params = new URLSearchParams({ include_docs: 'true', limit: '500' });
    if (start) { params.set('startkey', JSON.stringify(start)); params.set('skip', '1'); }
    const page = await couch(`_all_docs?${params}`);
    for (const row of page.rows) if (row.doc && !row.id.startsWith('_')) docs.push(row.doc);
    if (page.rows.length < 500) break;
    start = page.rows.at(-1).id;
  }
  return docs;
}
export async function remote(path, { method = 'GET', body, headers: extra = {}, stream = false } = {}) {
  const config = syncConfig();
  const headers = { Authorization: `Bearer ${config.secret}`, 'X-Sync-Node': config.nodeId, ...extra };
  if (body !== undefined && !stream) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${config.cloudUrl.replace(/\/$/, '')}/api/internal/sync/${path}`, { method, headers, body: stream ? body : body === undefined ? undefined : JSON.stringify(body), ...(stream ? { duplex: 'half' } : {}), signal: AbortSignal.timeout(stream ? 300000 : 60000), redirect: 'error', cache: 'no-store' });
  if (!response.ok) throw new SyncHttpError(response.status);
  return response;
}
