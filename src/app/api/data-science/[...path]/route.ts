import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import {
  agentUsageErrorCode,
  logAgentUsage,
} from "@/lib/agent-usage";
import { auth } from "@/lib/auth";
import { logAuditEvent, sanitizeTechnicalMessage } from "@/lib/audit-log";
import { db } from "@/lib/db";
import {
  canAccessDataScience,
  getSessionUserRole,
} from "@/lib/role-redirect";
import type { AgentUsageTool } from "@/lib/schema/agent-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataScienceRouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

type JsonRecord = Record<string, unknown>;

const DATA_SCIENCE_API_URL =
  process.env.DATA_SCIENCE_API_URL ?? "http://localhost:8000";
const DATA_SCIENCE_INTERNAL_TOKEN =
  process.env.DATA_SCIENCE_INTERNAL_TOKEN ?? process.env.DS_INTERNAL_TOKEN;

export async function GET(
  request: NextRequest,
  context: DataScienceRouteContext,
) {
  return proxyDataScienceRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: DataScienceRouteContext,
) {
  return proxyDataScienceRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: DataScienceRouteContext,
) {
  return proxyDataScienceRequest(request, context);
}

async function proxyDataScienceRequest(
  request: NextRequest,
  context: DataScienceRouteContext,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ detail: "No autenticado." }, { status: 401 });
  }

  const role = getSessionUserRole(session.user);
  if (!canAccessDataScience(role)) {
    return NextResponse.json({ detail: "No autorizado." }, { status: 403 });
  }

  const { path } = await context.params;
  const pathname = path.join("/");
  const targetUrl = new URL(pathname, ensureTrailingSlash(DATA_SCIENCE_API_URL));
  targetUrl.search = request.nextUrl.search;
  if (pathname === "chats" || pathname.startsWith("chats/")) {
    targetUrl.searchParams.set("ownerId", session.user.id);
  }

  const startedAt = Date.now();
  const createdAt = new Date(startedAt).toISOString();
  let requestBody: JsonRecord = {};
  const init: RequestInit = {
    headers: buildHeaders(),
    method: request.method,
  };

  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      const rawBody = await request.text();
      requestBody = parseJsonRecord(rawBody);
      const mergedBody =
        pathname === "chat" || pathname === "chat/stream" || pathname === "reports"
          ? mergeSessionScope(requestBody, session.user, role)
          : requestBody;
      requestBody = mergedBody;
      init.body = JSON.stringify(mergedBody);
    }

    const response = await fetch(targetUrl, init);

    if (
      pathname === "chat/stream" &&
      response.body &&
      response.headers.get("content-type")?.includes("text/event-stream")
    ) {
      const stream = auditChatStream(response.body, {
        actorId: session.user.id,
        actorRole: role,
        createdAt,
        initialConversationId: stringValue(requestBody.conversationId),
        scope: requestBody.scope,
        startedAt,
      });

      return new Response(stream, {
        headers: {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        },
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    await auditNonStreamRequest({
      actorId: session.user.id,
      actorRole: role,
      body,
      createdAt,
      pathname,
      requestBody,
      startedAt,
      status: response.status,
    });

    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    const action = getAuditedAction(pathname);
    await logAuditEvent({
      action: "agent_proxy_error",
      actorEmail: session.user.email,
      actorId: session.user.id,
      category: "error",
      component: "data-science-proxy",
      details: { method: request.method, path: pathname },
      errorCode: error instanceof Error ? error.name : "proxy_error",
      message: sanitizeTechnicalMessage(error),
      severity: "error",
      status: "failed",
    });
    if (action) {
      await logAgentUsage({
        action,
        actorId: session.user.id,
        actorRole: role,
        conversationId:
          stringValue(requestBody.conversationId) ??
          getConversationIdFromArtifactPath(pathname),
        createdAt,
        durationMs: Date.now() - startedAt,
        errorCode: "assistant_unavailable",
        messageIndex: getMessageIndexFromArtifactPath(pathname),
        scope: requestBody.scope,
        status: "failed",
      });
    }

    return NextResponse.json(
      {
        detail:
          error instanceof SyntaxError
            ? "La solicitud no contiene JSON válido."
            : "No se pudo conectar con el asistente de investigacion.",
      },
      { status: error instanceof SyntaxError ? 400 : 502 },
    );
  }
}

function auditChatStream(
  body: ReadableStream<Uint8Array>,
  context: {
    actorId: string;
    actorRole: ReturnType<typeof getSessionUserRole>;
    createdAt: string;
    initialConversationId?: string;
    scope: unknown;
    startedAt: number;
  },
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let finalized = false;
  let streamFailed = false;
  let conversationId = context.initialConversationId;
  let messageIndex: number | undefined;
  let intent: string | undefined;
  let model: string | undefined;
  let provider: string | undefined;
  let tools: AgentUsageTool[] = [];
  let artifactCount = 0;
  let sourceCount = 0;

  const finalize = (status: "cancelled" | "failed" | "succeeded") => {
    if (finalized) return;
    finalized = true;
    void logAgentUsage({
      action: "query",
      actorId: context.actorId,
      actorRole: context.actorRole,
      artifactCount,
      conversationId,
      createdAt: context.createdAt,
      durationMs: Date.now() - context.startedAt,
      errorCode: status === "failed" ? "agent_error" : undefined,
      intent,
      messageIndex,
      model,
      provider,
      scope: context.scope,
      sourceCount,
      status,
      tools,
    });
  };

  const inspect = (text: string) => {
    pending += text;
    const blocks = pending.split("\n\n");
    pending = blocks.pop() ?? "";

    for (const block of blocks) {
      const line = block
        .split(/\r?\n/)
        .find((current) => current.startsWith("data: "));
      if (!line) continue;

      try {
        const event = JSON.parse(line.slice(6)) as {
          data?: unknown;
          type?: string;
        };
        if (event.type === "artifacts" && Array.isArray(event.data)) {
          artifactCount = event.data.length;
        } else if (event.type === "sources" && Array.isArray(event.data)) {
          sourceCount = event.data.length;
        } else if (event.type === "error") {
          streamFailed = true;
        } else if (event.type === "done" && isRecord(event.data)) {
          conversationId =
            stringValue(event.data.conversation_id) ?? conversationId;
          messageIndex = numberValue(event.data.assistant_message_index);
          intent = stringValue(event.data.intent);
          model = stringValue(event.data.model);
          provider = stringValue(event.data.provider);
          tools = toolArray(event.data.tools);
        }
      } catch {
        // Los fragmentos SSE que no sean JSON no modifican la auditoría.
      }
    }
  };

  return new ReadableStream<Uint8Array>({
    cancel(reason) {
      finalize("cancelled");
      return reader.cancel(reason);
    },
    start(controller) {
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            inspect(decoder.decode(value, { stream: true }));
            controller.enqueue(value);
          }
          inspect(decoder.decode());
          controller.close();
          finalize(streamFailed ? "failed" : "succeeded");
        } catch (error) {
          controller.error(error);
          finalize("failed");
        }
      };
      void pump();
    },
  });
}

async function auditNonStreamRequest({
  actorId,
  actorRole,
  body,
  createdAt,
  pathname,
  requestBody,
  startedAt,
  status,
}: {
  actorId: string;
  actorRole: ReturnType<typeof getSessionUserRole>;
  body: unknown;
  createdAt: string;
  pathname: string;
  requestBody: JsonRecord;
  startedAt: number;
  status: number;
}) {
  const action = getAuditedAction(pathname);
  if (!action) return;

  const result = isRecord(body) ? body : {};
  const conversationId =
    stringValue(result.conversation_id) ??
    stringValue(requestBody.conversationId) ??
    getConversationIdFromArtifactPath(pathname);
  const messageIndex =
    numberValue(result.assistant_message_index) ??
    getMessageIndexFromArtifactPath(pathname);
  const scope =
    requestBody.scope ??
    (action === "artifact_changed"
      ? await getStoredMessageScope(conversationId, messageIndex)
      : undefined);

  await logAgentUsage({
    action,
    actorId,
    actorRole,
    artifactCount: Array.isArray(result.artifacts) ? result.artifacts.length : undefined,
    conversationId,
    createdAt,
    durationMs: Date.now() - startedAt,
    errorCode: status >= 400 ? agentUsageErrorCode(status) : undefined,
    intent: stringValue(result.intent),
    messageIndex,
    model: stringValue(result.model),
    provider: stringValue(result.provider),
    scope,
    sourceCount: Array.isArray(result.sources) ? result.sources.length : undefined,
    status: status >= 400 ? "failed" : "succeeded",
    tools: toolArray(result.tools),
  });
}

function getAuditedAction(pathname: string) {
  if (pathname === "chat" || pathname === "chat/stream") return "query" as const;
  if (pathname === "reports") return "preset_report" as const;
  if (/^chats\/[^/]+\/artifacts\/\d+\/\d+$/.test(pathname)) {
    return "artifact_changed" as const;
  }
  return null;
}

async function getStoredMessageScope(
  conversationId?: string,
  messageIndex?: number,
) {
  if (!conversationId || messageIndex === undefined) return undefined;

  try {
    const chat = (await db.get(conversationId)) as unknown;
    if (!isRecord(chat) || chat.type !== "investigacion_chat") return undefined;
    const messages = Array.isArray(chat.messages) ? chat.messages : [];
    const message = messages[messageIndex];
    return isRecord(message) ? message.scope : undefined;
  } catch {
    return undefined;
  }
}

function getConversationIdFromArtifactPath(pathname: string) {
  const match = pathname.match(/^chats\/([^/]+)\/artifacts\/\d+\/\d+$/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function getMessageIndexFromArtifactPath(pathname: string) {
  const match = pathname.match(/^chats\/[^/]+\/artifacts\/(\d+)\/\d+$/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function buildHeaders() {
  const requestHeaders = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });

  if (DATA_SCIENCE_INTERNAL_TOKEN) {
    requestHeaders.set("Authorization", `Bearer ${DATA_SCIENCE_INTERNAL_TOKEN}`);
  }

  return requestHeaders;
}

function mergeSessionScope(
  body: JsonRecord,
  user: { id: string; role?: string | null },
  role: ReturnType<typeof getSessionUserRole>,
) {
  const scope = isRecord(body.scope) ? body.scope : {};

  return {
    ...body,
    scope: {
      ...scope,
      role,
      userId: user.id,
    },
  };
}

function parseJsonRecord(rawBody: string): JsonRecord {
  if (!rawBody) return {};
  const parsed = JSON.parse(rawBody) as unknown;
  if (!isRecord(parsed)) throw new SyntaxError("JSON object required");
  return parsed;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function toolArray(value: unknown): AgentUsageTool[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item === "string" && item) {
      return [{ name: item, status: "succeeded" as const }];
    }
    if (!isRecord(item)) return [];

    const name = stringValue(item.name);
    const status = item.status;
    if (!name || (status !== "failed" && status !== "succeeded")) return [];
    return [{ name, status }];
  });
}
