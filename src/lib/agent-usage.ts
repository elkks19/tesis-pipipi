import "server-only";

import { db } from "@/lib/db";
import type { AuthRole } from "@/lib/auth-role-values";
import type {
  AgentUsage,
  AgentUsageAction,
  AgentUsageScope,
  AgentUsageStatus,
  AgentUsageTool,
} from "@/lib/schema/agent-usage";

type LogAgentUsageInput = {
  action: AgentUsageAction;
  actorId: string;
  actorRole: AuthRole;
  artifactCount?: number;
  conversationId?: string | null;
  createdAt?: string;
  durationMs: number;
  errorCode?: string;
  intent?: string | null;
  messageIndex?: number | null;
  model?: string | null;
  provider?: string | null;
  scope?: unknown;
  sourceCount?: number;
  status: AgentUsageStatus;
  tools?: string[] | AgentUsageTool[];
};

export async function logAgentUsage(input: LogAgentUsageInput) {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const completedAt = new Date().toISOString();
  const document: AgentUsage & { _id: string } = {
    _id: `agent-usage:${createdAt}:${crypto.randomUUID()}`,
    type: "agent_usage",
    action: input.action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    completedAt,
    createdAt,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    environment:
      process.env.APP_ENVIRONMENT === "raspberry" ? "raspberry" : "cloud",
    nodeId: process.env.SYNC_NODE_ID?.trim() || "cloud",
    status: input.status,
  };

  if (input.artifactCount !== undefined) document.artifactCount = input.artifactCount;
  if (input.conversationId) document.conversationId = input.conversationId;
  if (input.errorCode) document.errorCode = input.errorCode;
  if (input.intent) document.intent = input.intent;
  if (input.messageIndex !== undefined && input.messageIndex !== null) {
    document.messageIndex = input.messageIndex;
  }
  if (input.model) document.model = input.model;
  if (input.provider) document.provider = input.provider;
  if (input.sourceCount !== undefined) document.sourceCount = input.sourceCount;

  const scope = sanitizeAgentUsageScope(input.scope);
  if (scope) document.scope = scope;

  if (input.tools?.length) {
    document.tools = input.tools.map((tool) =>
      typeof tool === "string"
        ? { name: tool, status: "succeeded" as const }
        : tool,
    );
  }

  try {
    await db.put(document);
  } catch (error) {
    console.error("[agent-usage] no se pudo guardar el evento", {
      action: input.action,
      error: error instanceof Error ? error.name : "unknown",
      status: input.status,
    });
  }
}

export function sanitizeAgentUsageScope(value: unknown): AgentUsageScope | undefined {
  if (!isRecord(value)) return undefined;

  const stationKey =
    typeof value.stationKey === "string" && value.stationKey.trim()
      ? value.stationKey.trim()
      : undefined;
  const rawViajeIds = Array.isArray(value.viajeIds)
    ? value.viajeIds
    : typeof value.viajeId === "string"
      ? [value.viajeId]
      : [];
  const viajeIds = [
    ...new Set(
      rawViajeIds
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);

  if (!stationKey && viajeIds.length === 0) return undefined;
  return {
    ...(stationKey ? { stationKey } : {}),
    ...(viajeIds.length ? { viajeIds } : {}),
  };
}

export function agentUsageErrorCode(status: number) {
  if (status === 429) return "quota_exceeded";
  if (status >= 500) return "assistant_unavailable";
  if (status === 404) return "resource_not_found";
  if (status >= 400) return "invalid_request";
  return "unknown_error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
