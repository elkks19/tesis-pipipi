import type { Instrumentation } from "next";

export function register() {}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logAuditEvent, sanitizeTechnicalMessage } = await import("./lib/audit-log");
  const errorName = error instanceof Error ? error.name : "unknown_error";
  const digest = typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
    ? error.digest
    : undefined;
  await logAuditEvent({
    action: "server_error",
    category: "error",
    component: context.routePath || context.routeType,
    details: {
      digest: digest ?? null,
      method: request.method,
      path: request.path,
      routeType: context.routeType,
    },
    errorCode: digest ?? errorName,
    message: sanitizeTechnicalMessage(error),
    severity: "error",
    status: "failed",
  });
};
