import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  canAccessDocente,
  canAccessEstudiante,
  getSessionUserRole,
} from "@/lib/role-redirect";
import {
  getHistoriaClinicalPdfFileName,
  renderHistoriaClinicalPdf,
} from "@/lib/reports/historia-clinica-pdf";
import { getHistoriaClinicalPdfData } from "@/lib/reports/historia-clinica-pdf-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      idHistoria: string;
    }>;
  },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const role = getSessionUserRole(session?.user);
  const canGenerateReport =
    canAccessDocente(role) || canAccessEstudiante(role);

  if (!session?.user || !canGenerateReport) {
    return Response.json(
      { message: "No tienes permiso para generar este reporte." },
      { status: 403 },
    );
  }

  try {
    const { idHistoria } = await context.params;
    const historiaId = decodeURIComponent(idHistoria);

    const data = await getHistoriaClinicalPdfData({
      generatedBy: session.user.name ?? session.user.email ?? session.user.id,
      historiaId,
    });

    if (!data) {
      return Response.json(
        { message: "Historia no encontrada." },
        { status: 404 },
      );
    }

    const disposition = new URL(request.url).searchParams.has("download")
      ? "attachment"
      : "inline";
    const pdf = renderHistoriaClinicalPdf(data);
    const fileName = getHistoriaClinicalPdfFileName(data);

    return new Response(pdf, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
        "Content-Type": "application/pdf",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    console.error("[historia-report-route] failed to generate report", error);

    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo generar el reporte.",
      },
      { status: 500 },
    );
  }
}
