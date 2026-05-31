import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  renderInvestigacionReportPdf,
  type InvestigacionReport,
} from "@/lib/reports/investigacion-report-pdf";
import {
  canAccessDataScience,
  getSessionUserRole,
} from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return Response.json({ message: "No autenticado." }, { status: 401 });
  }

  if (!canAccessDataScience(getSessionUserRole(session.user))) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const report = (await request.json()) as InvestigacionReport;
  if (!report.answer || !Array.isArray(report.artifacts)) {
    return Response.json({ message: "Reporte invalido." }, { status: 400 });
  }

  const pdf = renderInvestigacionReportPdf(report);

  return new Response(pdf, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="reporte-investigacion-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
