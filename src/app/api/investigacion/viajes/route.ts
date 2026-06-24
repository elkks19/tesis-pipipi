import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { searchDataScienceTripOptions } from "@/lib/data-science-trip-options";
import {
  canAccessDataScience,
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

  if (!canAccessDataScience(getSessionUserRole(session.user))) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const query = url.searchParams.get("q") ?? "";
  const cursor = url.searchParams.get("cursor");
  const result = await searchDataScienceTripOptions({
    cursor,
    limit: Number.isFinite(limit) ? limit : 20,
    query,
  });

  return Response.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
