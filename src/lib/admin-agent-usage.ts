import "server-only";

import { getAuthUsersByIds } from "@/lib/auth-users";
import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type {
  AgentUsage,
  AgentUsageAction,
  AgentUsageStatus,
} from "@/lib/schema/agent-usage";

export type AdminAgentUsageFilters = {
  action?: AgentUsageAction;
  actorId?: string;
  cursor?: string;
  from?: string;
  limit?: number;
  status?: AgentUsageStatus;
  to?: string;
};

export type AdminAgentUsageRow = AgentUsage & {
  actorEmail?: string;
  actorName: string;
  id: string;
};

export type AdminAgentUsagePage = {
  hasNextPage: boolean;
  nextCursor?: string;
  rows: AdminAgentUsageRow[];
};

export type AdminAgentUsageDetail = {
  event: AdminAgentUsageRow;
  message?: {
    answer: string;
    artifacts: unknown[];
    question: string;
    sources: unknown[];
  };
};

export async function fetchAdminAgentUsagePage(
  filters: AdminAgentUsageFilters,
): Promise<AdminAgentUsagePage> {
  await ensureTesisIndexes();

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 50);
  const selector: Record<string, unknown> = {
    createdAt: dateSelector(filters.from, filters.to),
    type: "agent_usage",
  };
  if (filters.actorId) selector.actorId = filters.actorId;
  if (filters.action) selector.action = filters.action;
  if (filters.status) selector.status = filters.status;

  const primary = filters.actorId
    ? "actorId"
    : filters.action
      ? "action"
      : filters.status
        ? "status"
        : null;
  const sort = [
    { type: "desc" },
    ...(primary ? [{ [primary]: "desc" }] : []),
    { createdAt: "desc" },
  ];

  const result = await findTesisDocs({
    bookmark: filters.cursor,
    limit,
    selector,
    sort,
    use_index: primary
      ? `idx_agent_usage_${primary === "actorId" ? "actor" : primary}_created`
      : "idx_agent_usage_created",
  });

  const events = result.docs.filter(isAgentUsage);
  const users = getAuthUsersByIds(events.map((event) => event.actorId));

  return {
    hasNextPage: events.length === limit,
    nextCursor: events.length === limit ? result.bookmark : undefined,
    rows: events.map((event) => {
      const user = users.get(event.actorId);
      return {
        ...event,
        actorEmail: user?.email,
        actorName: user?.name ?? event.actorId,
        id: event._id,
      };
    }),
  };
}

export async function getAdminAgentUsageDetail(
  eventId: string,
): Promise<AdminAgentUsageDetail | null> {
  let eventDocument: unknown;
  try {
    eventDocument = await db.get(eventId);
  } catch {
    return null;
  }
  if (!isAgentUsage(eventDocument)) return null;

  const user = getAuthUsersByIds([eventDocument.actorId]).get(eventDocument.actorId);
  const event: AdminAgentUsageRow = {
    ...eventDocument,
    actorEmail: user?.email,
    actorName: user?.name ?? eventDocument.actorId,
    id: eventDocument._id,
  };

  if (
    !eventDocument.conversationId ||
    eventDocument.messageIndex === undefined
  ) {
    return { event };
  }

  try {
    const chat = (await db.get(eventDocument.conversationId)) as unknown;
    if (!isRecord(chat) || chat.type !== "investigacion_chat") {
      return { event };
    }
    const messages = Array.isArray(chat.messages) ? chat.messages : [];
    const assistant = messages[eventDocument.messageIndex];
    if (!isRecord(assistant) || assistant.role !== "assistant") {
      return { event };
    }
    let question = "";
    for (let index = eventDocument.messageIndex - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (isRecord(message) && message.role === "user") {
        question = String(message.content ?? "");
        break;
      }
    }

    return {
      event,
      message: {
        answer: String(assistant.content ?? ""),
        artifacts: Array.isArray(assistant.artifacts) ? assistant.artifacts : [],
        question,
        sources: Array.isArray(assistant.sources) ? assistant.sources : [],
      },
    };
  } catch {
    return { event };
  }
}

function dateSelector(from?: string, to?: string) {
  const selector: Record<string, string | boolean> = { $exists: true };
  if (from) selector.$gte = from;
  if (to) selector.$lte = to;
  return selector;
}

function isAgentUsage(
  value: unknown,
): value is PouchDB.Core.ExistingDocument<AgentUsage> {
  return (
    isRecord(value) &&
    value.type === "agent_usage" &&
    typeof value._id === "string" &&
    typeof value.actorId === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.action === "string" &&
    typeof value.status === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
