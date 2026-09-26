import { syncConfig, validateSyncConfig } from './config.mjs';
import { couch, controlGet, controlPut, controlList, ensureControl, remote } from './couch.mjs';
import { reconcileReplication, replicationStatus } from './replication.mjs';
import { conflictList } from './control.mjs';
import { importAccounts } from './accounts.mjs';
import { synchronizeFiles } from './files.mjs';

export function isCaughtUp(snapshot) {
  return !snapshot.paused && snapshot.replication?.length === 2 && snapshot.replication.every((r) => r.state === 'running' && r.pending === 0 && r.failures === 0) && snapshot.files?.pending === 0 && snapshot.files?.conflicts === 0 && snapshot.accounts?.ok === true && snapshot.conflicts === 0 && !snapshot.error;
}
async function mirrorTrips(trips) {
  for (const trip of trips) {
    const existing = await controlGet(trip._id);
    await controlPut({ ...trip, _rev: existing?._rev });
  }
}
export async function syncCycle() {
  const config = syncConfig(); validateSyncConfig(config);
  if (!config.enabled || config.environment !== 'raspberry') return;
  await ensureControl();
  const snapshot = { paused: false, replication: [], files: null, accounts: null, conflicts: null, error: null };
  const completed = [];
  try {
    // Apply local pause/resume even when the cloud is unreachable.
    let localSettings = await controlGet('settings') ?? { _id: 'settings', paused: false };
    for (const command of (await controlList('command:')).filter((c) => c.state === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (command.action === 'pause') localSettings.paused = true;
      if (['resume', 'sync'].includes(command.action)) localSettings.paused = false;
      await controlPut(localSettings);
      localSettings = await controlGet('settings');
      await reconcileReplication(localSettings.paused, command.action === 'sync');
      await controlPut({ ...command, state: 'completed', completedAt: new Date().toISOString() });
    }
    snapshot.paused = localSettings.paused;
    await reconcileReplication(localSettings.paused);
    const state = await (await remote('state')).json();
    await mirrorTrips(state.trips);
    let settings = await controlGet('settings') ?? { _id: 'settings', paused: false };
    const commands = [...await controlList('command:'), ...state.commands].filter((c) => c.state === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let restart = false;
    for (const command of commands) {
      if (command.action === 'pause') settings.paused = true;
      if (command.action === 'resume') settings.paused = false;
      if (command.action === 'sync') { settings.paused = false; restart = true; }
      if (['prepare', 'return'].includes(command.action)) settings.paused = false;
      completed.push(command._id);
    }
    await controlPut(settings);
    snapshot.paused = settings.paused;
    await reconcileReplication(settings.paused, restart);
    snapshot.replication = await replicationStatus();
    if (!settings.paused) {
      const accounts = await (await remote('accounts')).json();
      const imported = importAccounts(accounts);
      let missingAccess = 0;
      for (const ownership of state.trips.filter((trip) => trip.phase === 'preparing')) {
        const trip = await couch(encodeURIComponent(ownership.tripId), { missing: true });
        if (!trip) { missingAccess++; continue; }
        const ids = new Set((trip.estaciones ?? []).flatMap((station) => [station.docenteEncargadoId, ...(station.estudiantesIds ?? [])]).filter(Boolean));
        for (const id of ids) if (!accounts.accounts.some((account) => account.userId === id && account.password) || accounts.users.find((user) => user.id === id)?.banned) missingAccess++;
      }
      snapshot.accounts = { ok: missingAccess === 0, count: imported.count, missingAccess, updatedAt: new Date().toISOString() };
      snapshot.files = await synchronizeFiles();
      snapshot.conflicts = (await conflictList()).length;
      snapshot.replication = await replicationStatus();
    }
    // Require a stable source sequence across consecutive cycles with writes fenced.
    const database = await couch('');
    const previous = await controlGet('barrier');
    const ready = isCaughtUp(snapshot) && previous?.sequence === JSON.stringify(database.update_seq);
    await controlPut({ ...previous, _id: 'barrier', sequence: JSON.stringify(database.update_seq), ready: isCaughtUp(snapshot) });
    const acknowledged = commands.filter((command) => state.trips.some((trip) => trip.tripId === command.tripId && ((command.action === 'prepare' && trip.phase === 'raspberry') || (command.action === 'return' && trip.phase === 'cloud')))).map((command) => command.tripId);
    if (ready && previous?.ready) {
      for (const trip of state.trips.filter((trip) => ['preparing', 'returning'].includes(trip.phase))) {
        const result = await (await remote('handoff', { method: 'POST', body: { tripId: trip.tripId, expectedRevision: trip._rev, phase: trip.phase, snapshot } })).json();
        await mirrorTrips([result]); acknowledged.push(trip.tripId);
      }
    }
    for (const id of completed) {
      const command = commands.find((c) => c._id === id);
      if (['prepare', 'return'].includes(command.action) && !acknowledged.includes(command.tripId)) continue;
      const local = await controlGet(id);
      if (local) await controlPut({ ...local, state: 'completed', completedAt: new Date().toISOString() });
      else await remote('ack', { method: 'POST', body: { id } });
    }
  } catch {
    snapshot.error = 'No se pudo completar el ciclo. Revisa conexión, credenciales y servicios; se reintentará automáticamente.';
    snapshot.replication = await replicationStatus().catch(() => []);
  }
  const report = { snapshot, updatedAt: new Date().toISOString() };
  const current = await controlGet(`status:${config.nodeId}`);
  await controlPut({ ...current, _id: `status:${config.nodeId}`, ...report });
  await remote('heartbeat', { method: 'POST', body: report }).catch(() => {});
  return report;
}
export async function startSyncSupervisor() {
  const config = syncConfig();
  if (!config.enabled || config.environment !== 'raspberry') return { close: async () => {} };
  validateSyncConfig(config);
  let stopped = false; let timer; let running;
  const tick = () => {
    if (stopped) return;
    running = syncCycle().catch(() => console.error('[sync] Ciclo fallido; revisa la configuración local.')).finally(() => { if (!stopped) timer = setTimeout(tick, config.interval * 1000); });
  };
  tick();
  return { close: async () => { stopped = true; clearTimeout(timer); await running; } };
}
