import {
  buildViajeStudentsReportData,
  getViajeStudentsReportFileName,
  renderViajeStudentsReportPdf,
} from "@/lib/reports/viaje-students-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await buildViajeStudentsReportData(decodeURIComponent(id));

  if (!data) {
    return Response.json({ message: "Viaje no encontrado." }, { status: 404 });
  }

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
    console.error("[viaje-pdf-route] failed to generate report", error);

    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo generar el PDF del viaje.",
      },
      { status: 500 },
    );
  }
}
