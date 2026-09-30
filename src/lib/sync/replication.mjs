import { syncConfig } from './config.mjs';
import { couch } from './couch.mjs';

export function replicationDefinitions(config) {
  const local = new URL(config.localUrl);
  const username = decodeURIComponent(local.username); const password = decodeURIComponent(local.password);
  local.username = ''; local.password = '';
  const source = { url: local.toString().replace(/\/$/, ''), auth: { basic: { username, password } } };
  const target = { url: config.remoteUrl.replace(/\/$/, ''), auth: { basic: { username: config.username, password: config.password } } };
  return [{ _id: `tesis-${config.nodeId}-push`, source, target, continuous: true, create_target: false }, { _id: `tesis-${config.nodeId}-pull`, source: target, target: source, continuous: true, create_target: false }];
}
export async function reconcileReplication(paused = false, restart = false) {
  const config = syncConfig();
  for (const desired of replicationDefinitions(config)) {
    const path = `_replicator/${encodeURIComponent(desired._id)}`;
    let existing = await couch(path, { server: true, missing: true });
    if (existing && (paused || restart)) {
      await couch(`${path}?rev=${encodeURIComponent(existing._rev)}`, { server: true, method: 'DELETE' });
      existing = null;
    }
    if (!paused && (!existing || JSON.stringify(existing.source) !== JSON.stringify(desired.source) || JSON.stringify(existing.target) !== JSON.stringify(desired.target))) {
      const tombstone = !existing ? await couch(`_replicator/_all_docs?key=${encodeURIComponent(JSON.stringify(desired._id))}`, { server: true }) : null;
      const revision = existing?._rev ?? tombstone?.rows?.[0]?.value?.rev;
      await couch(path, { server: true, method: 'PUT', body: { ...desired, ...(revision ? { _rev: revision } : {}) } });
    }
  }
}
export async function replicationStatus() {
  const result = [];
  for (const definition of replicationDefinitions(syncConfig())) {
    const raw = await couch(`_scheduler/docs/_replicator/${encodeURIComponent(definition._id)}`, { server: true, missing: true });
    const jobs = raw?.id ? await couch(`_scheduler/jobs/${encodeURIComponent(raw.id)}`, { server: true, missing: true }) : null;
    const info = { ...(raw?.info ?? {}), ...(jobs?.info ?? {}) };
    result.push({ direction: definition._id.endsWith('push') ? 'push' : 'pull', state: raw?.state ?? 'not_started', pending: typeof info.changes_pending === 'number' ? info.changes_pending : null, written: typeof info.docs_written === 'number' ? info.docs_written : null, failures: typeof info.doc_write_failures === 'number' ? info.doc_write_failures : null, updatedAt: raw?.last_updated ?? null, error: ['failed', 'crashing', 'error'].includes(raw?.state) ? 'La replicación no pudo continuar. Revisa conexión y permisos de CouchDB.' : null, history: (jobs?.history ?? []).slice(0, 10).map((event) => ({ type: event.type, timestamp: event.timestamp })) });
  }
  return result;
}
