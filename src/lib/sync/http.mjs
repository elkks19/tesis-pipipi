import { Readable } from 'node:stream';
import { syncConfig, validateSyncConfig, validSharedSecret } from './config.mjs';
import { controlGet, controlPut, controlList, ensureControl, allDocuments } from './couch.mjs';
import { exportAccounts } from './accounts.mjs';
import { isCaughtUp } from './engine.mjs';
import { fileManifest, syncDisk, referencedFiles, validFileKey, verifiedReceive, fileInfo, fileResolutions } from './files.mjs';

export async function internalSyncRequest(request, path) {
  const config = syncConfig();
  if (!config.enabled || config.environment !== 'cloud') return Response.json({ error: 'No disponible.' }, { status: 404 });
  if (!validSharedSecret(request.headers.get('authorization')?.replace(/^Bearer /, ''), config.secret) || request.headers.get('x-sync-node') !== config.nodeId) return Response.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    validateSyncConfig(config); await ensureControl();
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (path === 'state') return Response.json({ trips: await controlList('trip:'), commands: (await controlList('command:')).filter((c) => c.state === 'pending') }, { headers: { 'Cache-Control': 'no-store' } });
      if (path === 'accounts') return Response.json(exportAccounts(), { headers: { 'Cache-Control': 'no-store' } });
      if (path === 'file-resolutions') return Response.json(await fileResolutions(), { headers: { 'Cache-Control': 'no-store' } });
      if (path === 'files') return Response.json(await fileManifest(), { headers: { 'Cache-Control': 'no-store' } });
    }
    if (path === 'file' && ['GET', 'PUT'].includes(request.method)) {
      const key = url.searchParams.get('key');
      if (!validFileKey(key) || !referencedFiles(await allDocuments()).includes(key)) return Response.json({ error: 'Archivo no referenciado.' }, { status: 404 });
      const disk = await syncDisk();
      if (request.method === 'GET') {
        const info = await fileInfo(key, disk);
        if (info.missing) return Response.json({ error: 'Archivo pendiente.' }, { status: 404 });
        return new Response(Readable.toWeb(await disk.getStream(key)), { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-File-Sha256': info.sha256, 'X-File-Size': String(info.size) } });
      }
      if (!request.body) return Response.json({ error: 'Archivo requerido.' }, { status: 400 });
      return Response.json(await verifiedReceive(key, Readable.fromWeb(request.body), { sha256: request.headers.get('x-file-sha256'), size: Number(request.headers.get('x-file-size')) }, disk));
    }
    if (request.method === 'POST') {
      const text = await request.text(); if (text.length > 200000) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
      const data = JSON.parse(text);
      if (path === 'heartbeat') {
        const current = await controlGet(`status:${config.nodeId}`);
        await controlPut({ ...current, _id: `status:${config.nodeId}`, snapshot: data.snapshot, updatedAt: data.updatedAt, receivedAt: new Date().toISOString() });
        return Response.json({ ok: true });
      }
      if (path === 'ack') {
        if (typeof data.id !== 'string' || !data.id.startsWith('command:')) return Response.json({ error: 'Orden inválida.' }, { status: 400 });
        const command = await controlGet(data.id);
        if (!command) return Response.json({ error: 'Orden no encontrada.' }, { status: 404 });
        await controlPut({ ...command, state: 'completed', completedAt: new Date().toISOString() });
        return Response.json({ ok: true });
      }
      if (path === 'handoff') {
        const trip = await controlGet(`trip:${data.tripId}`);
        if (!trip || trip._rev !== data.expectedRevision || trip.phase !== data.phase || !['preparing', 'returning'].includes(trip.phase) || !isCaughtUp(data.snapshot)) return Response.json({ error: 'El viaje no está listo para transferir el control.' }, { status: 409 });
        const next = { ...trip, phase: trip.phase === 'preparing' ? 'raspberry' : 'cloud', updatedAt: new Date().toISOString() };
        const saved = await controlPut(next);
        return Response.json({ ...next, _rev: saved.rev });
      }
    }
    return Response.json({ error: 'Operación no disponible.' }, { status: 404 });
  } catch {
    return Response.json({ error: 'No se pudo completar el intercambio. Revisa la configuración del servidor.' }, { status: 503 });
  }
}
