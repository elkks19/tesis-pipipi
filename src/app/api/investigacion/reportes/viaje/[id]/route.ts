import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  buildViajeStudentsReportData,
  getViajeStudentsReportFileName,
  renderViajeStudentsReportPdf,
} from "@/lib/reports/viaje-students-report";
import { canAccessDataScience, getSessionUserRole } from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ message: "No autenticado." }, { status: 401 });
  if (!canAccessDataScience(getSessionUserRole(session.user))) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
  const data = await buildViajeStudentsReportData(decodeURIComponent(id));
  if (!data) return Response.json({ message: "Viaje no encontrado." }, { status: 404 });

  try {
    const pdf = await renderViajeStudentsReportPdf(data);
    return new Response(pdf, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${getViajeStudentsReportFileName(data)}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "No se pudo generar el PDF del viaje." },
      { status: 500 },
    );
  }
}
