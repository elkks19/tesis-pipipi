import { headers } from "next/headers";
import { z } from "zod";

import { fetchAdminAuditPage, type AdminAuditFilters } from "@/lib/admin-audit";
import { auth } from "@/lib/auth";
import { canAccessAdmin, getSessionUserRole } from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const auditQuerySchema = z.object({
  action: z.string().trim().min(1).max(100).optional(),
  actorId: z.string().trim().min(1).max(200).optional(),
  category: z.enum(["access", "agent", "sync", "error"]),
  component: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).max(2_000).optional(),
  from: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  nodeId: z.string().trim().min(1).max(100).optional(),
  severity: z.enum(["error", "info", "warning"]).optional(),
  status: z.enum(["failed", "pending", "succeeded", "warning", "cancelled"]).optional(),
  to: z.iso.datetime().optional(),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ message: "No autenticado." }, { status: 401 });
  if (!canAccessAdmin(getSessionUserRole(session.user))) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const parsed = auditQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Filtros inválidos." }, { status: 400 });

  return Response.json(await fetchAdminAuditPage(parsed.data as AdminAuditFilters), {
    headers: { "Cache-Control": "no-store" },
  });
}
