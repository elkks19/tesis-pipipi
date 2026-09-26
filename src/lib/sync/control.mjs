import { randomUUID } from 'node:crypto';
import { syncConfig, validateSyncConfig } from './config.mjs';
import { couch, controlGet, controlPut, controlList, ensureControl } from './couch.mjs';

export async function queueCommand(action, actorId, tripId = undefined) {
  const config = syncConfig(); validateSyncConfig(config);
  if (!config.enabled) throw new Error('Activa SYNC_ENABLED después de configurar ambos entornos.');
  if (!['sync', 'pause', 'resume', 'prepare', 'return'].includes(action)) throw new Error('Acción inválida.');
  await ensureControl();
  if (['prepare', 'return'].includes(action)) {
    if (config.environment !== 'cloud') throw new Error('La asignación del viaje se administra desde la nube.');
    if (typeof tripId !== 'string' || !tripId) throw new Error('Selecciona un viaje.');
    const trip = await couch(encodeURIComponent(tripId), { missing: true });
    if (trip?.type !== 'viaje') throw new Error('Viaje no encontrado.');
    const state = await controlGet(`trip:${tripId}`);
    if (action === 'prepare' && state && !['cloud', 'preparing'].includes(state.phase)) throw new Error('El viaje ya está asignado.');
    if (action === 'return' && !['raspberry', 'returning'].includes(state?.phase)) throw new Error('El viaje no está operado por la Raspberry.');
    await controlPut({ ...state, _id: `trip:${tripId}`, tripId, nodeId: config.nodeId, phase: action === 'prepare' ? 'preparing' : 'returning', updatedAt: new Date().toISOString(), actorId });
  }
  const command = { _id: `command:${randomUUID()}`, action, actorId, tripId: tripId ?? null, state: 'pending', createdAt: new Date().toISOString() };
  await controlPut(command);
  return { id: command._id, state: command.state };
}
export async function conflictList() {
  const result = await couch('_find', { method: 'POST', body: { selector: { _conflicts: { $exists: true } }, conflicts: true, limit: 100, fields: ['_id', '_rev', '_conflicts', 'type', 'updatedAt'] } });
  return result.docs.map((doc) => ({ id: doc._id, type: doc.type ?? 'documento', revisions: [doc._rev, ...doc._conflicts] }));
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
  let configured = true;
  try { validateSyncConfig(config); } catch { configured = false; }
  if (!config.enabled || !configured) return { environment: config.environment, enabled: config.enabled, configured, nodeId: config.nodeId, stale: true, snapshot: null, commands: [], trips: [], conflicts: [], fileConflicts: [] };
  const [status, commands, trips, conflicts, fileConflicts, travel] = await Promise.all([controlGet(`status:${config.nodeId}`), controlList('command:'), controlList('trip:'), conflictList(), controlList('file-conflict:'), couch('_find', { method: 'POST', body: { selector: { type: 'viaje' }, limit: 10000, fields: ['_id', 'fechaEntrada', 'establecimiento', 'servicio'] } })]);
  return { environment: config.environment, enabled: true, configured, nodeId: config.nodeId, stale: !status || Date.now() - Date.parse(status.receivedAt ?? status.updatedAt) > config.interval * 3000, snapshot: status?.snapshot ?? null, availableTrips: travel.docs.map((trip) => ({ id: trip._id, name: `${trip.establecimiento?.nombre ?? trip.servicio ?? "Viaje"} · ${trip.fechaEntrada ?? ""}` })), updatedAt: status?.receivedAt ?? status?.updatedAt ?? null, commands: commands.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-30).map(({ _id, action, state, createdAt, completedAt, tripId }) => ({ id: _id, action, state, createdAt, completedAt, tripId })), trips: trips.map(({ tripId, phase }) => ({ tripId, phase })), conflicts, fileConflicts: fileConflicts.filter((item) => !item.resolved).map(({ _id, key, current, candidate }) => ({ id: _id, key, current: { sha256: current.sha256, size: current.size }, candidate: { sha256: candidate.sha256, size: candidate.size } })) };
}
