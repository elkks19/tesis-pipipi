// Explicit, disposable infrastructure only. Never reads the application's .env.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const a = process.env.SYNC_TEST_COUCH_A;
const b = process.env.SYNC_TEST_COUCH_B;
async function request(base, path, method = 'GET', body) {
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
  const headers = { 'Content-Type': 'application/json' };
  if (url.username) headers.Authorization = `Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64')}`;
  url.username = ''; url.password = '';
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function waitFor(fn) {
  for (let i = 0; i < 45; i++) {
    try { return await fn(); } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error('La replicación no convergió dentro del plazo.');
}
test('replicación nativa entre dos CouchDB aislados: adjuntos, cambios, borrado, conflicto y reanudación', { skip: !a || !b, timeout: 180000 }, async () => {
  assert.notEqual(new URL(a).origin, new URL(b).origin, 'Deben ser dos servidores de prueba distintos.');
  const name = `sync_test_${randomUUID().replaceAll('-', '')}`;
  const source = `${a.replace(/\/$/, '')}/${name}`;
  const target = `${b.replace(/\/$/, '')}/${name}`;
  let pushRev; let pullRev;
  const pushId = `${name}_push`; const pullId = `${name}_pull`;
  async function start(id, source, target) {
    return request(a, `_replicator/${id}`, 'PUT', { source, target, continuous: true, create_target: false });
  }
  try {
    await request(a, name, 'PUT'); await request(b, name, 'PUT');
    await request(a, `${name}/one`, 'PUT', { value: 'initial', _attachments: { 'sample.txt': { content_type: 'text/plain', data: Buffer.from('hello').toString('base64') } } });
    pushRev = (await start(pushId, source, target)).rev; pullRev = (await start(pullId, target, source)).rev;
    await waitFor(async () => { const doc = await request(b, `${name}/one?attachments=true`); assert.equal(doc._attachments['sample.txt'].data, Buffer.from('hello').toString('base64')); });
    await request(b, `${name}/two`, 'PUT', { value: 'from-cloud' });
    await waitFor(async () => assert.equal((await request(a, `${name}/two`)).value, 'from-cloud'));
    await request(a, `_replicator/${pushId}?rev=${pushRev}`, 'DELETE'); pushRev = null;
    await request(a, `_replicator/${pullId}?rev=${pullRev}`, 'DELETE'); pullRev = null;
    const left = await request(a, `${name}/one`); const right = await request(b, `${name}/one`);
    await request(a, `${name}/one`, 'PUT', { ...left, value: 'offline-a' });
    await request(b, `${name}/one`, 'PUT', { ...right, value: 'offline-b' });
    // New control IDs still reuse checkpoints: same source, target and replication options.
    pushRev = (await start(`${pushId}_resume`, source, target)).rev;
    pullRev = (await start(`${pullId}_resume`, target, source)).rev;
    await waitFor(async () => assert.equal((await request(a, `${name}/one?conflicts=true`))._conflicts.length, 1));
    const two = await request(a, `${name}/two`); await request(a, `${name}/two?rev=${two._rev}`, 'DELETE');
    await waitFor(async () => {
      const rows = await request(b, `${name}/_all_docs?key=${encodeURIComponent(JSON.stringify('two'))}`);
      assert.equal(rows.rows[0].value.deleted, true);
    });
  } finally {
    for (const id of [pushId, pullId, `${pushId}_resume`, `${pullId}_resume`]) {
      try { const doc = await request(a, `_replicator/${id}`); await request(a, `_replicator/${id}?rev=${doc._rev}`, 'DELETE'); } catch { /* already stopped */ }
    }
    await Promise.allSettled([request(a, name, 'DELETE'), request(b, name, 'DELETE')]);
  }
});
