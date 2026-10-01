import "server-only";

import { getAuthUsersByIds, listAuthUsers } from "@/lib/auth-users";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { AgentUsage } from "@/lib/schema/agent-usage";
import type { AuditCategory, AuditEvent } from "@/lib/schema/audit-log";

export type AdminAuditCategory = AuditCategory | "agent";

export type AdminAuditFilters = {
  action?: string;
  actorId?: string;
  category: AdminAuditCategory;
  component?: string;
  cursor?: string;
  from?: string;
  limit?: number;
  model?: string;
  nodeId?: string;
  severity?: string;
  status?: string;
  to?: string;
};

export type AdminAuditRow = {
  action: string;
  actorEmail?: string;
  actorId?: string;
  actorName?: string;
  category: AdminAuditCategory;
  component: string;
  createdAt: string;
  details: Record<string, boolean | number | string | null>;
  environment: "cloud" | "raspberry";
  id: string;
  message: string;
  nodeId: string;
  severity: "error" | "info" | "warning";
  status: string;
};

export type AdminAuditPage = {
  actors: Array<{ email: string; id: string; name: string }>;
  hasNextPage: boolean;
  nextCursor?: string;
  rows: AdminAuditRow[];
};

export async function fetchAdminAuditPage(filters: AdminAuditFilters): Promise<AdminAuditPage> {
  await ensureTesisIndexes();
  const limit = Math.min(Math.max(filters.limit ?? 30, 1), 100);
  const result = filters.category === "agent"
    ? await findAgentEvents(filters, limit)
    : await findAuditEvents(filters, limit);
  const users = getAuthUsersByIds(result.events.map((event) => event.actorId ?? ""));

  return {
    actors: listAuthUsers().map(({ email, id, name }) => ({ email, id, name })),
    hasNextPage: result.events.length === limit && Boolean(result.bookmark),
    nextCursor: result.events.length === limit ? result.bookmark : undefined,
    rows: result.events.map((event) => {
      const user = event.actorId ? users.get(event.actorId) : undefined;
      return {
        ...event,
        actorEmail: event.actorEmail ?? user?.email,
        actorName: user?.name ?? event.actorEmail ?? event.actorId,
      };
    }),
  };
}

export async function fetchAdminAuditExport(filters: AdminAuditFilters, maximum = 2_000) {
  const rows: AdminAuditRow[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchAdminAuditPage({ ...filters, cursor, limit: 100 });
    rows.push(...page.rows);
    cursor = page.nextCursor;
  } while (cursor && rows.length < maximum);
  return rows.slice(0, maximum);
}

async function findAgentEvents(filters: AdminAuditFilters, limit: number) {
  const selector: Record<string, unknown> = {
    createdAt: dateSelector(filters.from, filters.to),
    type: "agent_usage",
  };
  if (filters.actorId) selector.actorId = filters.actorId;
  if (filters.action) selector.action = filters.action;
  if (filters.status) selector.status = filters.status;
  if (filters.model) selector.model = filters.model;

  const primary = filters.actorId ? "actorId"
    : filters.action ? "action"
      : filters.status ? "status"
        : filters.model ? "model"
          : null;
  const result = await findTesisDocs({
    bookmark: filters.cursor,
    limit,
    selector,
    sort: [{ type: "desc" }, ...(primary ? [{ [primary]: "desc" }] : []), { createdAt: "desc" }],
    use_index: primary
      ? `idx_agent_usage_${primary === "actorId" ? "actor" : primary}_created`
      : "idx_agent_usage_created",
  });
  const documents = result.docs.filter(isAgentUsage);
  return {
    bookmark: result.bookmark,
    events: documents.map(agentRow),
  };
}

async function findAuditEvents(filters: AdminAuditFilters, limit: number) {
  const selector: Record<string, unknown> = {
    category: filters.category,
    createdAt: dateSelector(filters.from, filters.to),
    type: "audit_event",
  };
  if (filters.actorId) selector.actorId = filters.actorId;
  if (filters.action) selector.action = filters.action;
  if (filters.component) selector.component = filters.component;
  if (filters.nodeId) selector.nodeId = filters.nodeId;
  if (filters.severity) selector.severity = filters.severity;
  if (filters.status) selector.status = filters.status;

  const primary = filters.actorId ? "actorId"
    : filters.action ? "action"
      : filters.component ? "component"
        : filters.nodeId ? "nodeId"
          : filters.severity ? "severity"
            : filters.status ? "status"
              : null;
  const result = await findTesisDocs({
    bookmark: filters.cursor,
    limit,
    selector,
    sort: [
      { type: "desc" },
      { category: "desc" },
      ...(primary ? [{ [primary]: "desc" }] : []),
      { createdAt: "desc" },
    ],
    use_index: primary
      ? `idx_audit_${primary === "actorId" ? "actor" : primary}_created`
      : "idx_audit_category_created",
  });
  return {
    bookmark: result.bookmark,
    events: result.docs.filter(isAuditEvent).map(auditRow),
  };
}

function auditRow(document: PouchDB.Core.ExistingDocument<AuditEvent>): AdminAuditRow {
  return {
    action: document.action,
    actorEmail: document.actorEmail,
    actorId: document.actorId,
    category: document.category,
    component: document.component,
    createdAt: document.createdAt,
    details: document.details ?? {},
    environment: document.environment,
    id: document._id,
    message: document.message,
    nodeId: document.nodeId,
    severity: document.severity,
    status: document.status,
  };
}

function agentRow(document: PouchDB.Core.ExistingDocument<AgentUsage>): AdminAuditRow {
  return {
    action: document.action,
    actorId: document.actorId,
    category: "agent",
    component: "research-agent",
    createdAt: document.createdAt,
    details: {
      artifacts: document.artifactCount ?? 0,
      durationMs: document.durationMs,
      intent: document.intent ?? null,
      model: document.model ?? null,
      provider: document.provider ?? null,
      sources: document.sourceCount ?? 0,
      tools: document.tools?.map((tool) => `${tool.name}:${tool.status}`).join(", ") ?? null,
    },
    environment: document.environment,
    id: document._id,
    message: agentMessage(document),
    nodeId: document.nodeId,
    severity: document.status === "failed" ? "error" : document.status === "cancelled" ? "warning" : "info",
    status: document.status,
  };
}

function agentMessage(document: AgentUsage) {
  const labels: Record<string, string> = {
    artifact_changed: "Cambió la visualización de una respuesta",
    pdf_generated: "Generó un reporte PDF",
    preset_report: "Ejecutó un reporte predefinido",
    query: "Consultó al agente inteligente",
  };
  return document.errorCode
    ? `${labels[document.action] ?? document.action}. Código: ${document.errorCode}.`
    : labels[document.action] ?? document.action;
}

function dateSelector(from?: string, to?: string) {
  const selector: Record<string, string | boolean> = { $exists: true };
  if (from) selector.$gte = from;
  if (to) selector.$lte = to;
  return selector;
}

function isAuditEvent(value: unknown): value is PouchDB.Core.ExistingDocument<AuditEvent> {
  return isRecord(value)
    && value.type === "audit_event"
    && typeof value._id === "string"
    && typeof value.category === "string"
    && typeof value.createdAt === "string"
    && typeof value.message === "string";
}

function isAgentUsage(value: unknown): value is PouchDB.Core.ExistingDocument<AgentUsage> {
  return isRecord(value)
    && value.type === "agent_usage"
    && typeof value._id === "string"
    && typeof value.actorId === "string"
    && typeof value.createdAt === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
