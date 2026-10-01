import { headers } from "next/headers";
import { z } from "zod";

import {
  fetchAdminAgentUsagePage,
  type AdminAgentUsageFilters,
} from "@/lib/admin-agent-usage";
import { auth } from "@/lib/auth";
import { listAuthUsers } from "@/lib/auth-users";
import { canAccessAdmin, getSessionUserRole } from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  action: z
    .enum(["artifact_changed", "pdf_generated", "preset_report", "query"])
    .optional(),
  actorId: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().trim().min(1).max(1000).optional(),
  from: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(["cancelled", "failed", "succeeded"]).optional(),
  to: z.iso.datetime().optional(),
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ message: "No autenticado." }, { status: 401 });
  }
  if (!canAccessAdmin(getSessionUserRole(session.user))) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json({ message: "Filtros inválidos." }, { status: 400 });
  }

  const page = await fetchAdminAgentUsagePage(
    parsed.data as AdminAgentUsageFilters,
  );
  return Response.json({
    ...page,
    actors: listAuthUsers().map((user) => ({
      email: user.email,
      id: user.id,
      name: user.name,
    })),
  });
}
