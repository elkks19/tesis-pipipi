import { headers } from "next/headers";

import { fetchChangeStats } from "@/lib/admin-dashboard";
import { auth } from "@/lib/auth";
import {
  canAccessAdmin,
  getSessionUserRole,
} from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return Response.json({ message: "No autenticado." }, { status: 401 });
  }

  if (!canAccessAdmin(getSessionUserRole(session.user))) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const viajeId = url.searchParams.get("viajeId");

  if (!viajeId) {
    return Response.json({ message: "Viaje requerido." }, { status: 400 });
  }

  const stats = await fetchChangeStats(viajeId);

  return Response.json(stats, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
