import { getAuthenticatedUser } from "@/lib/auth-session";
import { conflictVersions, queueCommand, resolveConflict, syncStatus } from "@/lib/sync/control.mjs";
import { resolveFileConflict } from "@/lib/sync/files.mjs";
import { syncConfig } from "@/lib/sync/config.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusEventStream(request: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        try { controller.close(); } catch { /* already closed */ }
      };
      const send = async () => {
        if (closed) return;
        try {
          const status = await syncStatus();
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(status)}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(`event: sync-error\ndata: {"message":"No se pudo actualizar el estado."}\n\n`));
        }
        if (!closed) timer = setTimeout(send, 5000);
      };
      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      void send();
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  const configured = [
    process.env.BETTER_AUTH_URL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));
  // Trust explicit configuration, never Host/X-Forwarded-Host supplied by a client.
  return configured.some((value) => {
    try {
      const url = new URL(value.trim());
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.origin === origin;
    } catch {
      return false;
    }
  });
}
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Solo administradores." }, { status: 403 });
  const path = (await context.params).path.join("/");
  try {
    if (request.method === "GET" && path === "events") return statusEventStream(request);
    if (request.method === "GET" && path === "status") return Response.json(await syncStatus(), { headers: { "Cache-Control": "no-store" } });
    if (!syncConfig().enabled) return Response.json({ error: "La sincronización está desactivada." }, { status: 409 });
    if (request.method === "GET" && path === "conflicts") return Response.json(await conflictVersions(new URL(request.url).searchParams.get("id")), { headers: { "Cache-Control": "no-store" } });
    if (request.method === "POST") {
      // Browser mutations require an explicitly trusted origin and an admin session.
      if (!hasTrustedOrigin(request)) return Response.json({ error: "Origen inválido." }, { status: 403 });
      const data = await request.json();
      if (path === "files") return Response.json(await resolveFileConflict(data.id, data.selected, data.expected, user.id));
      if (path === "commands") return Response.json(await queueCommand(data.action, user.id), { status: 202 });
      if (path === "conflicts") {
        if (typeof data.id !== "string" || typeof data.selected !== "string" || !Array.isArray(data.expected) || !data.expected.every((r: unknown) => typeof r === "string")) return Response.json({ error: "Selección inválida." }, { status: 400 });
        return Response.json(await resolveConflict(data.id, data.selected, data.expected, user.id));
      }
    }
    return Response.json({ error: "Operación no disponible." }, { status: 404 });
  } catch {
    return Response.json({ error: "No se pudo completar la operación. Actualiza el estado y revisa la configuración o las revisiones seleccionadas." }, { status: 409 });
  }
}
export { handle as GET, handle as POST };
