import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import type {
  AuditCategory,
  AuditDetailValue,
  AuditEvent,
  AuditSeverity,
  AuditStatus,
} from "@/lib/schema/audit-log";

type LogAuditEventInput = {
  action: string;
  actorEmail?: string | null;
  actorId?: string | null;
  category: AuditCategory;
  component: string;
  createdAt?: string;
  details?: Record<string, unknown>;
  errorCode?: string | null;
  message: string;
  severity?: AuditSeverity;
  status: AuditStatus;
};

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /([?&](?:token|secret|password|key)=)[^&\s]+/gi,
  /\b(?:password|secret|api[_-]?key|authorization)\s*[:=]\s*[^,;\s]+/gi,
];

export async function logAuditEvent(input: LogAuditEventInput) {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const document: AuditEvent & { _id: string } = {
    _id: `audit:${input.category}:${createdAt}:${crypto.randomUUID()}`,
    type: "audit_event",
    action: safeToken(input.action, "event"),
    category: input.category,
    component: safeToken(input.component, "application"),
    createdAt,
    environment: process.env.APP_ENVIRONMENT === "raspberry" ? "raspberry" : "cloud",
    message: sanitizeTechnicalMessage(input.message, 1_000),
    nodeId: process.env.SYNC_NODE_ID?.trim() || "cloud",
    severity: input.severity ?? (input.status === "failed" ? "error" : "info"),
    status: input.status,
  };

  if (input.actorId) document.actorId = String(input.actorId).slice(0, 200);
  if (input.actorEmail) document.actorEmail = String(input.actorEmail).trim().toLowerCase().slice(0, 320);
  if (input.errorCode) document.errorCode = safeToken(input.errorCode, "unknown_error");
  const details = sanitizeDetails(input.details);
  if (Object.keys(details).length) document.details = details;

  try {
    await db.put(document);
  } catch (error) {
    console.error("[audit] no se pudo guardar el evento", {
      category: input.category,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

export function sanitizeTechnicalMessage(value: unknown, limit = 1_000) {
  let message = value instanceof Error ? value.message : String(value ?? "Error sin mensaje");
  for (const pattern of SECRET_PATTERNS) {
    message = message.replace(pattern, "[REDACTED]");
  }
  message = message.replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi, "https://[REDACTED]@");
  return message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, limit);
}

export function hashAuditAddress(value: string | null) {
  if (!value) return undefined;
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? "audit"}:${value}`)
    .digest("hex")
    .slice(0, 20);
}

function sanitizeDetails(value?: Record<string, unknown>) {
  const details: Record<string, AuditDetailValue> = {};
  for (const [rawKey, rawValue] of Object.entries(value ?? {}).slice(0, 30)) {
    const key = safeToken(rawKey, "detail").slice(0, 80);
    if (rawValue === null || typeof rawValue === "boolean") details[key] = rawValue;
    else if (typeof rawValue === "number" && Number.isFinite(rawValue)) details[key] = rawValue;
    else if (typeof rawValue === "string") details[key] = sanitizeTechnicalMessage(rawValue, 500);
  }
  return details;
}

function safeToken(value: string, fallback: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "_").slice(0, 100);
  return normalized || fallback;
}
