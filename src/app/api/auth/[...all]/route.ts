import { auth } from "@/lib/auth";
import { hashAuditAddress, logAuditEvent } from "@/lib/audit-log";
import { findAuthUserByEmail } from "@/lib/auth-users";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);
type Handler = (request: Request) => Promise<Response>;

function audited(method: keyof typeof handlers): Handler {
  return async (request) => {
    const handler = handlers[method] as Handler;
    const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "") || "/";
    const event = classifyAuthPath(path);
    if (!event) return handler(request);

    const body = await readAuthBody(request);
    const email = stringValue(body.email)?.trim().toLowerCase();
    const knownUser = email ? findAuthUserByEmail(email) : undefined;
    const previousSession = event.kind === "logout"
      ? await auth.api.getSession({ headers: request.headers }).catch(() => null)
      : null;

    try {
      const response = await handler(request);
      const responseBody = await readResponseBody(response);
      const responseUser = isRecord(responseBody) && isRecord(responseBody.user)
        ? responseBody.user
        : undefined;
      const actorId = stringValue(responseUser?.id) ?? previousSession?.user.id ?? knownUser?.id;
      const actorEmail = stringValue(responseUser?.email) ?? previousSession?.user.email ?? email;
      const succeeded = response.status >= 200 && response.status < 400;
      const action = `${event.kind}_${succeeded ? "succeeded" : "failed"}`;
      await logAuditEvent({
        action,
        actorEmail,
        actorId,
        category: "access",
        component: "better-auth",
        details: {
          ipHash: hashAuditAddress(clientAddress(request)),
          method: request.method,
          path,
          provider: event.provider,
          statusCode: response.status,
          userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        },
        message: accessMessage(event.kind, succeeded),
        severity: succeeded ? "info" : "warning",
        status: succeeded ? "succeeded" : "failed",
      });
      return response;
    } catch (error) {
      await logAuditEvent({
        action: `${event.kind}_failed`,
        actorEmail: email,
        actorId: knownUser?.id,
        category: "access",
        component: "better-auth",
        details: { ipHash: hashAuditAddress(clientAddress(request)), method: request.method, path },
        errorCode: error instanceof Error ? error.name : "auth_error",
        message: accessMessage(event.kind, false),
        severity: "error",
        status: "failed",
      });
      throw error;
    }
  };
}

function classifyAuthPath(path: string) {
  if (path === "/sign-in/email") return { kind: "login", provider: "credential" } as const;
  if (path === "/sign-up/email") return { kind: "registration", provider: "credential" } as const;
  if (path === "/sign-out") return { kind: "logout", provider: "session" } as const;
  if (path.startsWith("/callback/")) return { kind: "login", provider: path.split("/").at(-1) ?? "oauth" } as const;
  return null;
}

function accessMessage(kind: "login" | "logout" | "registration", succeeded: boolean) {
  const labels = {
    login: succeeded ? "Inicio de sesión correcto." : "Intento de inicio de sesión rechazado.",
    logout: succeeded ? "Cierre de sesión correcto." : "No se pudo cerrar la sesión.",
    registration: succeeded ? "Registro de cuenta correcto." : "Intento de registro rechazado.",
  };
  return labels[kind];
}

async function readAuthBody(request: Request): Promise<Record<string, unknown>> {
  if (!["POST", "PUT", "PATCH"].includes(request.method)) return {};
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const value = await request.clone().json();
      return isRecord(value) ? value : {};
    }
    if (type.includes("application/x-www-form-urlencoded")) {
      return Object.fromEntries(await request.clone().formData());
    }
  } catch {
    // Better Auth conserva la responsabilidad de validar el cuerpo original.
  }
  return {};
}

async function readResponseBody(response: Response) {
  try {
    if (!response.headers.get("content-type")?.includes("application/json")) return null;
    return await response.clone().json();
  } catch {
    return null;
  }
}

function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const GET = audited("GET");
export const POST = audited("POST");
export const PATCH = audited("PATCH");
export const PUT = audited("PUT");
export const DELETE = audited("DELETE");
