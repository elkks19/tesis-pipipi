import carboneSdk from "carbone-sdk";

import { getAuthUsersByIds } from "@/lib/auth-users";
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

function getReportData(viaje: NonNullable<Awaited<ReturnType<typeof getViajeByDocId>>>) {
  const userIds = viaje.estaciones.flatMap((estacion) => [
    estacion.docenteEncargadoId,
    ...estacion.estudiantesIds,
  ]);
  const usersById = getAuthUsersByIds(userIds);
  const estaciones = viaje.estaciones.map((estacion) => {
    const docente = usersById.get(estacion.docenteEncargadoId);
    const estudiantes = estacion.estudiantesIds.map((studentId) => {
      const student = usersById.get(studentId);

      return {
        email: student?.email ?? "",
        id: studentId,
        nombre: student?.name ?? studentId,
      };
    });

    return {
      ...estacion,
      docenteEncargado: {
        email: docente?.email ?? "",
        id: estacion.docenteEncargadoId,
        nombre: docente?.name ?? estacion.docenteEncargadoId,
      },
      estudiantes,
      resumen: {
        estudiantes: estudiantes.length,
      },
    };
  });

  return {
    ...viaje,
    estaciones,
    resumen: {
      docentes: new Set(viaje.estaciones.map((estacion) => estacion.docenteEncargadoId)).size,
      estaciones: viaje.estaciones.length,
      estudiantes: new Set(
        viaje.estaciones.flatMap((estacion) => estacion.estudiantesIds),
      ).size,
    },
  };
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
    const reportData = getReportData(viaje);
    const result = await carbone.renderPromise(getCarboneTemplate(), {
      convertTo: "pdf",
      data: {
        generadoEn: new Date().toISOString(),
        viaje: reportData,
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
