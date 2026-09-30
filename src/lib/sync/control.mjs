import { syncFailure } from './diagnostics.mjs';
import { randomUUID } from 'node:crypto';
import { syncConfig, validateSyncConfig } from './config.mjs';
import { couch, controlGet, controlPut, controlList, ensureControl, allDocuments } from './couch.mjs';

export async function queueCommand(action, actorId) {
  const config = syncConfig(); validateSyncConfig(config);
  if (!config.enabled) throw new Error('Activa SYNC_ENABLED después de configurar ambos entornos.');
  if (!['sync', 'pause', 'resume'].includes(action)) throw new Error('Acción inválida.');
  await ensureControl();
  const command = { _id: `command:${randomUUID()}`, action, actorId, state: 'pending', createdAt: new Date().toISOString() };
  await controlPut(command);
  return { id: command._id, state: command.state };
}
export async function conflictList() {
  return (await allDocuments(true)).filter((doc) => doc._conflicts?.length).map((doc) => ({ id: doc._id, type: doc.type ?? 'documento', revisions: [doc._rev, ...doc._conflicts] }));
}
export async function conflictVersions(id) {
  if (!id || id.startsWith('_')) throw new Error('Documento inválido.');
  const leaves = await couch(`${encodeURIComponent(id)}?open_revs=all&attachments=true`);
  return leaves.filter((leaf) => leaf.ok && !leaf.ok._deleted).map((leaf) => leaf.ok);
}
export async function resolveConflict(id, selected, expected, actorId) {
  const versions = await conflictVersions(id);
  const revisions = versions.map((doc) => doc._rev).sort();
  if (!Array.isArray(expected) || JSON.stringify(revisions) !== JSON.stringify([...expected].sort())) throw new Error('Las revisiones cambiaron. Actualiza la comparación.');
  const chosen = versions.find((doc) => doc._rev === selected);
  if (!chosen || versions.length < 2) throw new Error('Selección inválida.');
  const auditId = `resolution:${randomUUID()}`;
  await controlPut({ _id: auditId, documentId: id, actorId, selected, versions, state: 'pending', createdAt: new Date().toISOString() });
  const result = await couch('_bulk_docs', { method: 'POST', body: { docs: [chosen, ...versions.filter((doc) => doc._rev !== selected).map((doc) => ({ _id: id, _rev: doc._rev, _deleted: true }))] } });
  const audit = await controlGet(auditId);
  const failed = result.some((row) => row.error);
  await controlPut({ ...audit, state: failed ? 'partial' : 'completed', completedAt: new Date().toISOString() });
  if (failed) throw new Error('La resolución quedó parcial; vuelve a consultar el conflicto.');
  return { ok: true };
}

export async function syncStatus() {
  const config = syncConfig();
  const diagnostics = [];
  let configured = true;
  try { validateSyncConfig(config); } catch { configured = false; diagnostics.push({ stage: 'configuration', message: 'Revisa las URL, las credenciales y el secreto de intercambio en las variables de entorno.' }); }
  const base = { environment: config.environment, enabled: config.enabled, configured, nodeId: config.nodeId, interval: config.interval, stale: true, snapshot: null, commands: [], conflicts: [], fileConflicts: [], diagnostics, updatedAt: null, database: null, changes: [], audit: [] };
  if (!config.enabled || !configured) return base;
  async function read(stage, task, fallback) {
    try { return await task(); } catch (error) { diagnostics.push(syncFailure(error, stage)); return fallback; }
  }
  const [status, commands, conflicts, fileConflicts, database, changeFeed, resolutions, fileResolutions] = await Promise.all([
    read('control', () => controlGet(`status:${config.nodeId}`), null),
    read('commands', () => controlList('command:'), []),
    read('conflicts', conflictList, []),
    read('files', () => controlList('file-conflict:'), []),
    read('data', () => couch(''), null),
    read('data', () => couch('_changes?descending=true&include_docs=true&style=all_docs&limit=80'), { results: [] }),
    read('control', () => controlList('resolution:'), []),
    read('control', () => controlList('file-resolution:'), []),
  ]);
  const updatedAt = status?.receivedAt ?? status?.updatedAt ?? null;
  const timestamp = Date.parse(updatedAt);
  return { ...base, stale: !Number.isFinite(timestamp) || Date.now() - timestamp > config.interval * 3000, snapshot: status?.snapshot ?? null, updatedAt,
    commands: commands.filter((c) => ['sync', 'pause', 'resume'].includes(c.action)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-50).map(({ _id, action, state, actorId, createdAt, completedAt }) => ({ id: _id, action, state, actorId, createdAt, completedAt })),
    conflicts,
    fileConflicts: fileConflicts.filter((item) => !item.resolved).map(({ _id, key, current, candidate }) => ({ id: _id, key, current: { sha256: current.sha256, size: current.size }, candidate: { sha256: candidate.sha256, size: candidate.size } })),
    database: database ? { name: database.db_name, documents: database.doc_count, deleted: database.doc_del_count, updateSequence: database.update_seq, diskSize: database.sizes?.file ?? null, activeSize: database.sizes?.active ?? null } : null,
    changes: (changeFeed?.results ?? []).map((change) => ({
      sequence: typeof change.seq === 'string' || typeof change.seq === 'number' ? String(change.seq) : JSON.stringify(change.seq),
      id: change.id,
      type: change.doc?.type ?? 'documento',
      revision: change.changes?.[0]?.rev ?? change.doc?._rev ?? null,
      revisions: (change.changes ?? []).map((item) => item.rev),
      deleted: Boolean(change.deleted ?? change.doc?._deleted),
      updatedAt: change.doc?.updatedAt ?? change.doc?.fechaActualizacion ?? change.doc?.createdAt ?? null,
    })),
    audit: [...resolutions, ...fileResolutions].sort((a, b) => String(b.completedAt ?? b.createdAt).localeCompare(String(a.completedAt ?? a.createdAt))).slice(0, 50).map((item) => ({
      id: item._id,
      kind: item._id.startsWith('file-resolution:') ? 'file' : 'document',
      target: item.documentId ?? item.key ?? item.conflictId,
      state: item.state,
      actorId: item.actorId,
      selected: item.selected,
      createdAt: item.createdAt,
      completedAt: item.completedAt,
    })),
  };
}
