import { getAuthenticatedUser } from "@/lib/auth-session";
import { conflictVersions, queueCommand, resolveConflict, syncStatus } from "@/lib/sync/control.mjs";
import { resolveFileConflict } from "@/lib/sync/files.mjs";
import { syncConfig } from "@/lib/sync/config.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Solo administradores." }, { status: 403 });
  const path = (await context.params).path.join("/");
  try {
    if (request.method === "GET" && path === "status") return Response.json(await syncStatus(), { headers: { "Cache-Control": "no-store" } });
    if (!syncConfig().enabled) return Response.json({ error: "La sincronización está desactivada." }, { status: 409 });
    if (request.method === "GET" && path === "conflicts") return Response.json(await conflictVersions(new URL(request.url).searchParams.get("id")), { headers: { "Cache-Control": "no-store" } });
    if (request.method === "POST") {
      // Machine endpoints use a different credential; browser mutations must be same-origin.
      if (request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL || request.url).origin) return Response.json({ error: "Origen inválido." }, { status: 403 });
      const data = await request.json();
      if (path === "files") return Response.json(await resolveFileConflict(data.id, data.selected, data.expected, user.id));
      if (path === "commands") return Response.json(await queueCommand(data.action, user.id, data.tripId), { status: 202 });
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
