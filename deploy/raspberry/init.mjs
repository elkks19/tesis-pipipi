// Mounted into /app/scripts so dependencies resolve from the published image.
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

let stage = 'validación de la configuración local';

function safeFailure(error) {
  const status = Number(error?.status);
  if (Number.isInteger(status) && status >= 400 && status <= 599) return `HTTP ${status}`;
  const code = error?.cause?.code ?? error?.code;
  const knownCodes = new Set(['ABORT_ERR', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'ENOTFOUND', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT']);
  if (knownCodes.has(code)) return code;
  const message = String(error?.message ?? '');
  const httpStatus = message.match(/HTTP\s+(\d{3})/i)?.[1];
  if (httpStatus) return `HTTP ${httpStatus}`;
  if (/timed?\s*out|timeout/i.test(message)) return 'TIMEOUT';
  if (/configura|inválid|requiere|colisión|incompleta|administrador con contraseña/i.test(message)) return message;
  return 'ERROR_INTERNO';
}

async function prepare() {
  const url = new URL(process.env.COUCHDB_URL);
  // Compose interpolates these credentials into a URL; reject ambiguous values.
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (!/^[a-zA-Z0-9_-]+$/.test(username) || !/^[a-zA-Z0-9_-]{8,}$/.test(password)) {
    throw new Error('Usa usuario alfanumérico y contraseña CouchDB de al menos 8 caracteres alfanuméricos (32 o más recomendado).');
  }
  const headers = { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`, 'Content-Type': 'application/json' };
  url.username = ''; url.password = '';
  stage = 'preparación de CouchDB local';
  for (const name of ['_users', '_replicator', '_global_changes', 'tesis']) {
    const response = await fetch(new URL(`/${name}`, url), { method: 'PUT', headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok && response.status !== 412) throw new Error(`No se pudo preparar CouchDB (HTTP ${response.status}).`);
    if (name === 'tesis' && response.ok) {
      const secured = await fetch(new URL('/tesis/_security', url), {
        method: 'PUT', headers,
        body: JSON.stringify({ admins: { names: [username], roles: [] }, members: { names: [username], roles: [] } }),
        signal: AbortSignal.timeout(30000),
      });
      if (!secured.ok) throw new Error('No se pudieron restringir los permisos de la base nueva.');
    }
  }
  stage = 'comprobación de cuentas locales';
  const file = process.env.BETTER_AUTH_SQLITE_PATH;
  let syncInitialized = false;
  let localCredentialReady = false;
  if (existsSync(file)) {
    const db = new Database(file, { readonly: true });
    try {
      const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user','account','sync_account_state')").all().map((row) => row.name));
      syncInitialized = tables.has('sync_account_state') && Boolean(db.prepare("SELECT version FROM sync_account_state WHERE id='cloud'").get());
      localCredentialReady = tables.has('user') && tables.has('account') && Boolean(db.prepare(`
        SELECT 1
        FROM "user" AS u
        INNER JOIN account AS a ON a.userId = u.id
        WHERE COALESCE(u.banned, 0) = 0
          AND a.providerId = 'credential'
          AND a.password IS NOT NULL
          AND length(a.password) > 0
        LIMIT 1
      `).get());
    } finally { db.close(); }
  }
  if (!syncInitialized && !localCredentialReady) {
    if (process.env.SYNC_ENABLED !== 'true') throw new Error('Primer arranque: configura la nube y SYNC_ENABLED=true para descargar cuentas antes de iniciar.');
    stage = 'descarga inicial de cuentas desde la nube';
    await import('/app/scripts/sync-bootstrap.mjs');
  } else if (!syncInitialized) {
    console.warn('Cuenta local con contraseña disponible. Se omite la descarga inicial porque la nube no es necesaria para este reinicio.');
  }
  console.log('Preparación completa. Las cuentas existentes permiten reiniciar sin conexión a la nube.');
}
prepare().catch((error) => {
  // Keep URLs, response bodies and credentials out of deployment logs.
  const detail = safeFailure(error);
  const cloudTemporarilyUnavailable = stage === 'descarga inicial de cuentas desde la nube'
    && new Set(['ABORT_ERR', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'ENOTFOUND', 'ETIMEDOUT', 'TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT']).has(detail);
  if (cloudTemporarilyUnavailable) {
    console.warn(`La nube no está disponible (${detail}). La aplicación continuará y reintentará la sincronización en segundo plano.`);
    return;
  }
  console.error(`Falló la preparación. Etapa: ${stage}. Detalle: ${detail}.`);
  process.exitCode = 1;
});
