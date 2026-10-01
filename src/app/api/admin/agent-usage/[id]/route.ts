import { headers } from "next/headers";

import { getAdminAgentUsageDetail } from "@/lib/admin-agent-usage";
import { auth } from "@/lib/auth";
import { canAccessAdmin, getSessionUserRole } from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "No autenticado." }, { status: 401 });
  }
  if (!canAccessAdmin(getSessionUserRole(session.user))) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
  const detail = await getAdminAgentUsageDetail(decodeURIComponent(id));
  if (!detail) {
    return Response.json({ message: "Evento no encontrado." }, { status: 404 });
  }

  return Response.json(detail);
}
