import { randomUUID } from 'node:crypto';

import { couch } from './couch.mjs';
import { syncConfig } from './config.mjs';

export async function writeSyncAudit({ action, actorId, details = {}, message, status = 'succeeded' }) {
  const createdAt = new Date().toISOString();
  const config = syncConfig();
  const document = {
    _id: `audit:sync:${createdAt}:${randomUUID()}`,
    type: 'audit_event',
    category: 'sync',
    action: safe(action),
    ...(actorId ? { actorId: String(actorId).slice(0, 200) } : {}),
    component: 'sync-supervisor',
    createdAt,
    details: Object.fromEntries(Object.entries(details).slice(0, 20).flatMap(([key, value]) => {
      if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) return [[safe(key), typeof value === 'string' ? value.slice(0, 500) : value]];
      return [];
    })),
    environment: config.environment,
    message: String(message || action).slice(0, 1000),
    nodeId: config.nodeId,
    severity: status === 'failed' ? 'error' : status === 'warning' ? 'warning' : 'info',
    status,
  };
  try {
    await couch(encodeURIComponent(document._id), { method: 'PUT', body: document });
  } catch (error) {
    console.error('[sync-audit] no se pudo guardar el evento', error?.name ?? 'unknown');
  }
}

function safe(value) {
  return String(value || 'event').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '_').slice(0, 100);
}
