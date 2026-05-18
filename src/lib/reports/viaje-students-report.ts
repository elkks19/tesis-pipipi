import "server-only";

import type { AuthUserListItem } from "@/lib/auth-users";

import { getViajeByDocId } from "@/app/admin/viajes/queries";

export type ViajeStudentsReportData = NonNullable<
  Awaited<ReturnType<typeof buildViajeStudentsReportData>>
>;

function getCarboneTemplate() {
  return process.env.CARBONE_VIAJE_TEMPLATE_ID || "";
}

function getCarboneUrl() {
  const url = process.env.CARBONE_URL;

  if (!url) {
    return undefined;
  }

  return url.endsWith("/") ? url : `${url}/`;
}

function allowInsecureCarboneTls() {
  return (
    process.env.CARBONE_TLS_INSECURE === "true" ||
    process.env.CARBONE_TLS_INSECURE === "1"
  );
}

function configureCarboneTls() {
  if (!allowInsecureCarboneTls()) {
    return;
  }

  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.warn(
      "[viaje-report] CARBONE_TLS_INSECURE activo: Node no validara el certificado TLS de Carbone.",
    );
  }
}

function getFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function userName(user: AuthUserListItem | undefined, fallbackId: string) {
  return user?.name?.trim() || fallbackId;
}

function isCarboneV5NumericTemplateId(template: string) {
  return /^\d+$/.test(template);
}

function logReportStep(message: string, details?: Record<string, unknown>) {
  console.info(
    "[viaje-report]",
    message,
    details ? JSON.stringify(details) : "",
  );
}

export function getViajeStudentsReportFileName(data: ViajeStudentsReportData) {
  return `reporte-viaje-${getFileName(data.servicio || data.id)}.pdf`;
}

export async function buildViajeStudentsReportData(viajeId: string) {
  const viaje = await getViajeByDocId(viajeId);

  if (!viaje) {
    return null;
  }

  return {
    docId: viaje.docId,
    establecimiento: {
      contacto: viaje.establecimiento.contacto ?? "",
      direccion: viaje.establecimiento.direccion ?? "",
      nombre: viaje.establecimiento.nombre,
    },
    estaciones: viaje.estaciones.map((estacion) => ({
      docente: userName(
        estacion.docenteEncargado,
        estacion.docenteEncargadoId,
      ),
      estudiantes: [
        ...estacion.estudiantes.map((student) => userName(student, student.id)),
        ...estacion.estudiantesNoEncontrados,
      ].sort((a, b) => a.localeCompare(b, "es")),
      tipo: estacion.tipo,
    })),
    fechaEntrada: viaje.fechaEntrada,
    fechaSalida: viaje.fechaSalida,
    generadoEn: new Date().toISOString(),
    id: viaje.id,
    servicio: viaje.servicio,
    type: viaje.type,
  };
}

export async function renderViajeStudentsReportPdf(
  data: ViajeStudentsReportData,
) {
  const apiKey = process.env.CARBONE_API_KEY;
  const templateId = getCarboneTemplate();

  if (!apiKey) {
    throw new Error("CARBONE_API_KEY debe estar configurado.");
  }

  if (!isCarboneV5NumericTemplateId(templateId)) {
    throw new Error(
      "CARBONE_VIAJE_TEMPLATE_ID debe ser el ID numerico de Carbone v5.",
    );
  }

  const renderUrl = new URL(
    `render/${encodeURIComponent(templateId)}`,
    getCarboneUrl(),
  );
  renderUrl.searchParams.set("download", "true");

  logReportStep("rendering with carbone", {
    renderUrl: renderUrl.toString(),
    templateId,
    tlsInsecure: allowInsecureCarboneTls(),
  });

  let response: Response;

  try {
    configureCarboneTls();

    response = await fetch(renderUrl, {
      body: JSON.stringify({
        convertTo: "pdf",
        data,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "carbone-version": "5",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    console.error("[viaje-report] carbone fetch failed", error);
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new Error(
      `Carbone v5 no pudo generar el reporte. HTTP ${response.status} ${response.statusText}. ${body}`,
    );
  }

  const pdf = new Uint8Array(await response.arrayBuffer());

  logReportStep("carbone rendered PDF", {
    bytes: pdf.byteLength,
  });

  return pdf;
}
