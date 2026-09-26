import { syncConfig } from './config.mjs';
import { couch, controlGet, controlList } from './couch.mjs';

export function canWriteOwnedTrip(environment, state, nodeId) {
  if (environment === 'cloud') return !state || state.phase === 'cloud';
  return state?.phase === 'raspberry' && state.nodeId === nodeId;
}
export async function assertDocumentWrite(doc) {
  const config = syncConfig();
  if (!config.enabled || doc._id?.startsWith('_design/')) return;
  const previous = doc._id ? await couch(encodeURIComponent(doc._id), { missing: true }) : null;
  const documents = [previous, doc].filter(Boolean);
  for (const item of documents) {
    let tripId = item.type === 'viaje' ? item._id ?? item.id : item.viajeId;
    if (!tripId && item.historiaId) {
      const history = await couch(encodeURIComponent(item.historiaId), { missing: true }); tripId = history?.viajeId;
    }
    if (tripId) {
      const state = await controlGet(`trip:${tripId}`);
      if (!canWriteOwnedTrip(config.environment, state, config.nodeId)) throw new Error('Este viaje está bajo control del otro entorno o pendiente de sincronización. Solo consulta.');
    } else if (item.type === 'paciente') {
      const patientId = item._id ?? item.id;
      const result = patientId ? await couch('_find', { method: 'POST', body: { selector: { type: 'historia', pacienteId: patientId }, fields: ['viajeId'], limit: 100000 } }) : { docs: [] };
      const states = await controlList('trip:');
      for (const history of result.docs) {
        const state = states.find((candidate) => candidate.tripId === history.viajeId);
        if (config.environment === 'cloud' && !canWriteOwnedTrip('cloud', state, config.nodeId)) throw new Error('El paciente pertenece a un viaje operado en la Raspberry.');
      }
      if (config.environment === 'raspberry' && !states.some((state) => canWriteOwnedTrip('raspberry', state, config.nodeId) && (!result.docs.length || result.docs.some((history) => history.viajeId === state.tripId)))) throw new Error('No hay un viaje autorizado para modificar este paciente en la Raspberry.');
    } else if (config.environment === 'raspberry' && ['historia', 'receta', 'actividad', 'viajeInventarioItem', 'inventarioMovimiento', 'dispensacionReceta', 'insumoEntrega'].includes(item.type)) {
      throw new Error('Se requiere un viaje autorizado para escribir datos clínicos.');
    }
  }
}

export function attachWriteGuard(db) {
  for (const method of ['put', 'post', 'bulkDocs', 'remove']) {
    const original = db[method].bind(db);
    db[method] = async (...args) => {
      if (syncConfig().enabled) {
        const input = args[0];
        const docs = method === 'bulkDocs' ? Array.isArray(input) ? input : input.docs : [typeof input === 'string' ? { _id: input } : input];
        for (const doc of docs) await assertDocumentWrite(doc);
      }
      return original(...args);
    };
  }
  return db;
}
