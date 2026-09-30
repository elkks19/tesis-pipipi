import { syncConfig, validateSyncConfig } from './config.mjs';
import { controlGet, controlPut, controlList, ensureControl, remote } from './couch.mjs';
import { reconcileReplication, replicationStatus } from './replication.mjs';
import { conflictList } from './control.mjs';
import { importAccounts } from './accounts.mjs';
import { synchronizeFiles } from './files.mjs';
import { syncFailure } from './diagnostics.mjs';

export function isCaughtUp(snapshot) {
  return !snapshot.paused && !snapshot.running && snapshot.replication?.length === 2 && snapshot.replication.every((r) => r.state === 'running' && r.pending === 0 && r.failures === 0) && snapshot.files?.pending === 0 && snapshot.files?.conflicts === 0 && snapshot.accounts?.ok === true && snapshot.conflicts === 0 && !snapshot.error && !snapshot.errors?.length;
}
export async function syncCycle() {
  const config = syncConfig();
  if (!config.enabled || config.environment !== 'raspberry') return;
  /** @type {Array<ReturnType<typeof syncFailure>>} */
  const errors = [];
  const snapshot = { paused: false, running: true, stage: 'connection', connected: false, replication: [], files: null, accounts: null, conflicts: null, error: null, errors, startedAt: new Date().toISOString() };
  let controlReady = false;
  async function attempt(stage, task) {
    snapshot.stage = stage;
    try { return await task(); }
    catch (error) { snapshot.errors.push(syncFailure(error, stage)); return undefined; }
  }
  async function publish() {
    const report = { snapshot, updatedAt: new Date().toISOString() };
    if (controlReady) {
      const current = await controlGet(`status:${config.nodeId}`);
      await controlPut({ ...current, _id: `status:${config.nodeId}`, ...report });
    }
    if (snapshot.connected) await remote('heartbeat', { method: 'POST', body: report });
    return report;
  }
  await attempt('configuration', async () => { validateSyncConfig(config); await ensureControl(); controlReady = true; });
  if (controlReady) {
    let settings = await controlGet('settings') ?? { _id: 'settings', paused: false };
    snapshot.paused = settings.paused;
    async function apply(command, fromCloud) {
      const supported = ['sync', 'pause', 'resume'].includes(command.action);
      const receiptId = `applied:${command._id}`;
      // A lost acknowledgement must not reapply an old pause over a newer resume.
      if (supported && !await controlGet(receiptId)) {
        settings.paused = command.action === 'pause';
        await controlPut(settings); settings = await controlGet('settings');
        snapshot.paused = settings.paused;
        await reconcileReplication(settings.paused, command.action === 'sync');
        await controlPut({ _id: receiptId, action: command.action, appliedAt: new Date().toISOString() });
      }
      if (fromCloud) await remote('ack', { method: 'POST', body: { id: command._id, state: supported ? 'completed' : 'cancelled' } });
      else await controlPut({ ...command, state: supported ? 'completed' : 'cancelled', completedAt: new Date().toISOString() });
    }
    await attempt('commands', async () => {
      for (const command of (await controlList('command:')).filter((c) => c.state === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt))) await apply(command, false);
    });
    // Native replication continues independently of the cloud application endpoint.
    await attempt('data', () => reconcileReplication(settings.paused));
    const state = await attempt('connection', async () => {
      const result = await (await remote('state')).json();
      snapshot.connected = true;
      return result;
    });
    if (state) await attempt('commands', async () => {
      for (const command of state.commands.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) await apply(command, true);
    });
    await attempt('heartbeat', publish);
    if (!settings.paused) {
      if (state) {
        await attempt('accounts', async () => {
          const imported = importAccounts(await (await remote('accounts')).json());
          snapshot.accounts = { ok: true, count: imported.count, updatedAt: new Date().toISOString() };
        });
        await attempt('heartbeat', publish);
        await attempt('files', async () => { snapshot.files = await synchronizeFiles(); });
      }
      await attempt('conflicts', async () => { snapshot.conflicts = (await conflictList()).length; });
    }
    await attempt('data', async () => { snapshot.replication = await replicationStatus(); });
  }
  snapshot.running = false; snapshot.stage = 'idle';
  snapshot.error = snapshot.errors.length ? 'Hay operaciones pendientes de reintento. Revisa el detalle de cada servicio.' : null;
  await attempt('heartbeat', publish);
  return { snapshot, updatedAt: new Date().toISOString() };
}
export async function startSyncSupervisor() {
  const config = syncConfig();
  if (!config.enabled || config.environment !== 'raspberry') return { close: async () => {} };
  let stopped = false; let timer; let running;
  const tick = () => {
    if (stopped) return;
    running = syncCycle().catch(() => console.error('[sync] No se pudo acceder al control local; se reintentará.')).finally(() => { if (!stopped) timer = setTimeout(tick, config.interval * 1000); });
  };
  tick();
  return { close: async () => { stopped = true; clearTimeout(timer); await running; } };
}
