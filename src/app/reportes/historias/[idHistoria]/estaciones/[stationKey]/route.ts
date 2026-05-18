import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { canAccessDocente, getSessionUserRole } from "@/lib/role-redirect";
import {
  buildStationHistoryReport,
  renderStationHistoryReportHtml,
} from "@/lib/reports/station-history-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      idHistoria: string;
      stationKey: string;
    }>;
  },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || !canAccessDocente(getSessionUserRole(session.user))) {
    return Response.json(
      { message: "Solo docentes pueden generar reportes." },
      { status: 403 },
    );
  }

  const { idHistoria, stationKey } = await context.params;
  const data = await buildStationHistoryReport({
    historiaId: decodeURIComponent(idHistoria),
    stationKey,
  });

  if (!data) {
    return Response.json(
      { message: "Historia o estacion no encontrada." },
      { status: 404 },
    );
  }

  return new Response(renderStationHistoryReportHtml(data), {
    headers: {
      "Content-Disposition": `inline; filename="${data.fileName}"`,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
