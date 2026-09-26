import { internalSyncRequest } from "@/lib/sync/http.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return internalSyncRequest(request, (await context.params).path.join("/"));
}
export { handle as GET, handle as POST, handle as PUT };
