import carboneSdk from "carbone-sdk";

import { getViajeByDocId } from "../../queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const placeholderTemplateId =
  "0000000000000000000000000000000000000000000000000000000000000000";

function getCarboneTemplate() {
  return process.env.CARBONE_VIAJE_TEMPLATE_ID ?? placeholderTemplateId;
}

function getCarboneUrl() {
  const url = process.env.CARBONE_URL;

  if (!url) {
    return undefined;
  }

  return url.endsWith("/") ? url : `${url}/`;
}

function getFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const viaje = await getViajeByDocId(decodeURIComponent(id));

  if (!viaje) {
    return Response.json({ message: "Viaje no encontrado." }, { status: 404 });
  }

  const apiKey = process.env.CARBONE_API_KEY;

  if (!apiKey) {
    return Response.json(
      { message: "CARBONE_API_KEY debe estar configurado." },
      { status: 500 },
    );
  }

  const carbone = carboneSdk(apiKey);
  const carboneUrl = getCarboneUrl();

  if (carboneUrl) {
    carbone.setOptions({
      carboneUrl,
      isReturningBuffer: true,
    });
  }

  try {
    const result = await carbone.renderPromise(getCarboneTemplate(), {
      convertTo: "pdf",
      data: {
        generadoEn: new Date().toISOString(),
        viaje,
      },
    });
    const fileName = `viaje-${getFileName(viaje.servicio || viaje.id)}.pdf`;

    return new Response(new Uint8Array(result.content), {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
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
