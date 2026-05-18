import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { canAccessDocente, getSessionUserRole } from "@/lib/role-redirect";
import { generateHistoriaCarboneReport } from "@/lib/reports/historia-carbone-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      idHistoria: string;
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

  try {
    const { idHistoria } = await context.params;
    const historiaId = decodeURIComponent(idHistoria);

    console.info("[historia-report-route] generating report", {
      historiaId,
      userId: session.user.id,
    });

    const report = await generateHistoriaCarboneReport({
      historiaId,
      storageMode: "latest",
      solicitadoPor: session.user.name ?? session.user.email ?? session.user.id,
    });

    if (!report) {
      return Response.json(
        { message: "Historia no encontrada." },
        { status: 404 },
      );
    }

    return new Response(new Uint8Array(report.pdf), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `inline; filename="${report.file.nombre}"`,
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
