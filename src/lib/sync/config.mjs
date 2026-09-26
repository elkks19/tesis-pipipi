import { timingSafeEqual } from 'node:crypto';

/** @param {Record<string, string | undefined>} [env] */
export function syncConfig(env = process.env) {
  const environment = env.APP_ENVIRONMENT ?? 'cloud';
  if (!['cloud', 'raspberry'].includes(environment)) throw new Error('APP_ENVIRONMENT inválido.');
  const enabled = env.SYNC_ENABLED === 'true';
  const nodeId = env.SYNC_NODE_ID || 'raspberry-01';
  const controlDb = env.SYNC_CONTROL_DB || 'tesis_sync_control';
  const interval = Number(env.SYNC_INTERVAL_SECONDS || 60);
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(nodeId) || !/^[a-z][a-z0-9_-]{0,63}$/.test(controlDb)) throw new Error('Identificación de sincronización inválida.');
  if (!Number.isInteger(interval) || interval < 10 || interval > 3600) throw new Error('Intervalo de sincronización inválido.');
  return { environment, enabled, nodeId, controlDb, interval, localUrl: env.COUCHDB_URL || '', cloudUrl: env.SYNC_CLOUD_APP_URL || '', remoteUrl: env.SYNC_CLOUD_COUCHDB_URL || '', username: env.SYNC_CLOUD_COUCHDB_USERNAME || '', password: env.SYNC_CLOUD_COUCHDB_PASSWORD || '', secret: env.SYNC_SHARED_SECRET || '' };
}

export function validateSyncConfig(config) {
  if (!config.enabled) return;
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || ['true', '1'].includes(process.env.CARBONE_TLS_INSECURE)) throw new Error('La sincronización requiere verificación TLS habilitada.');
  if (config.secret.length < 32) throw new Error('SYNC_SHARED_SECRET requiere al menos 32 caracteres.');
  const local = new URL(config.localUrl);
  const database = decodeURIComponent(local.pathname.replace(/^\//, '').replace(/\/$/, ''));
  if (!database || database.startsWith('_') || database.includes('/') || database === config.controlDb) throw new Error('COUCHDB_URL debe señalar una base de aplicación independiente.');
  if (config.environment === 'raspberry') {
    for (const value of [config.cloudUrl, config.remoteUrl]) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) throw new Error('Las URL de nube deben usar HTTPS sin credenciales ni parámetros.');
    }
    const remote = new URL(config.remoteUrl);
    const name = decodeURIComponent(remote.pathname.replace(/^\//, '').replace(/\/$/, ''));
    if (!name || name.startsWith('_') || name.includes('/') || !config.username || !config.password) throw new Error('Configura la base y credenciales de CouchDB remoto.');
    if (remote.origin + remote.pathname === local.origin + local.pathname) throw new Error('Origen y destino deben ser diferentes.');
  }
}

export function validSharedSecret(received, expected) {
  if (!expected || expected.length < 32 || typeof received !== 'string') return false;
  const a = Buffer.from(received); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
