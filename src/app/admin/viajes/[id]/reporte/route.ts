import { buildViajeReportData } from "@/lib/reports/viaje-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function yesNo(value: boolean) {
  return value ? "Si" : "No";
}

function getFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function renderRows<T>(items: T[], render: (item: T, index: number) => string) {
  if (items.length === 0) {
    return `<tr><td colspan="99">Sin registros.</td></tr>`;
  }

  return items.map(render).join("");
}

function renderReportHtml(data: NonNullable<Awaited<ReturnType<typeof buildViajeReportData>>>) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reporte ${escapeHtml(data.viaje.servicio)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    h1, h2, h3 { margin: 0 0 8px; }
    h1 { font-size: 26px; }
    h2 { border-bottom: 2px solid #111; font-size: 18px; margin-top: 28px; padding-bottom: 6px; }
    h3 { font-size: 15px; margin-top: 18px; }
    .muted { color: #555; }
    .header { display: flex; justify-content: space-between; gap: 24px; border: 2px solid #111; padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .box { border: 1px solid #999; padding: 10px; }
    .box strong { display: block; font-size: 20px; }
    table { border-collapse: collapse; margin-top: 10px; width: 100%; }
    th, td { border: 1px solid #999; font-size: 12px; padding: 6px; text-align: left; vertical-align: top; }
    th { background: #eee; }
    ul { margin: 4px 0 0 18px; padding: 0; }
    .actions { margin: 16px 0; }
    button { border: 1px solid #111; background: white; cursor: pointer; padding: 8px 12px; }
    @media print {
      body { margin: 12mm; }
      .actions { display: none; }
      h2 { break-after: avoid; }
      table { break-inside: auto; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">Imprimir / guardar PDF</button>
  </div>

  <section class="header">
    <div>
      <h1>Reporte horrible del viaje</h1>
      <p><strong>Servicio:</strong> ${escapeHtml(data.viaje.servicio)}</p>
      <p><strong>Fechas:</strong> ${escapeHtml(data.viaje.fechaEntrada)} - ${escapeHtml(data.viaje.fechaSalida)}</p>
      <p><strong>Generado:</strong> ${escapeHtml(data.generadoEn)}</p>
    </div>
    <div>
      <p><strong>Establecimiento:</strong> ${escapeHtml(data.viaje.establecimiento.nombre)}</p>
      <p><strong>Direccion:</strong> ${escapeHtml(data.viaje.establecimiento.direccion ?? "Sin registrar")}</p>
      <p><strong>Contacto:</strong> ${escapeHtml(data.viaje.establecimiento.contacto ?? "Sin registrar")}</p>
    </div>
  </section>

  <section class="grid">
    <div class="box"><span>Pacientes</span><strong>${data.resumen.pacientes}</strong></div>
    <div class="box"><span>Historias</span><strong>${data.resumen.historias}</strong></div>
    <div class="box"><span>Diagnosticos</span><strong>${data.resumen.diagnosticos}</strong></div>
    <div class="box"><span>Actividades</span><strong>${data.resumen.actividades}</strong></div>
    <div class="box"><span>Ecografias</span><strong>${data.resumen.ecografias}</strong></div>
    <div class="box"><span>Laboratorios</span><strong>${data.resumen.laboratorios}</strong></div>
    <div class="box"><span>ECG</span><strong>${data.resumen.electrocardiogramas}</strong></div>
    <div class="box"><span>Espirometrias</span><strong>${data.resumen.espirometrias}</strong></div>
  </section>

  <h2>Estaciones y equipo</h2>
  <table>
    <thead>
      <tr>
        <th>Estacion</th>
        <th>Docente</th>
        <th>Estudiantes</th>
        <th>Solicitadas</th>
        <th>Completadas</th>
        <th>Pendientes</th>
      </tr>
    </thead>
    <tbody>
      ${renderRows(data.estaciones, (estacion) => `
        <tr>
          <td>${escapeHtml(estacion.tipo)}</td>
          <td>${escapeHtml(estacion.docenteEncargado.nombre)}<br><span class="muted">${escapeHtml(estacion.docenteEncargado.email)}</span></td>
          <td><ul>${estacion.estudiantes.map((student) => `<li>${escapeHtml(student.nombre)} <span class="muted">${escapeHtml(student.email)}</span></li>`).join("")}</ul></td>
          <td>${escapeHtml(estacion.produccion?.solicitadas ?? "")}</td>
          <td>${escapeHtml(estacion.produccion?.completadas ?? "")}</td>
          <td>${escapeHtml(estacion.produccion?.pendientes ?? "")}</td>
        </tr>
      `)}
    </tbody>
  </table>

  <h2>Pacientes</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Paciente</th><th>Documento</th><th>Genero</th><th>Edad</th><th>Lugar nacimiento</th></tr>
    </thead>
    <tbody>
      ${renderRows(data.pacientes, (paciente, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(paciente.nombreCompleto)}</td>
          <td>${escapeHtml(paciente.documento)}</td>
          <td>${escapeHtml(paciente.genero)}</td>
          <td>${escapeHtml(paciente.edad ?? "")}</td>
          <td>${escapeHtml(paciente.lugarNacimiento)}</td>
        </tr>
      `)}
    </tbody>
  </table>

  <h2>Historias</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Paciente</th><th>Documento</th><th>Motivo</th><th>Estaciones completadas</th><th>Complementarios</th><th>Diagnostico</th><th>Plan</th>
      </tr>
    </thead>
    <tbody>
      ${renderRows(data.historias, (historia, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(historia.paciente.nombreCompleto)}</td>
          <td>${escapeHtml(historia.paciente.documento)}</td>
          <td>${escapeHtml(historia.motivoConsulta)}</td>
          <td>${escapeHtml(historia.estacionesCompletadas.join(", "))}</td>
          <td>
            Eco: ${yesNo(historia.examenesComplementariosSolicitados.ecografia)}<br>
            Lab: ${yesNo(historia.examenesComplementariosSolicitados.laboratorios)}<br>
            Esp: ${yesNo(historia.examenesComplementariosSolicitados.espirometria)}<br>
            ECG: ${yesNo(historia.examenesComplementariosSolicitados.electrocardiograma)}
          </td>
          <td>${escapeHtml(historia.diagnosticoPrincipal)}</td>
          <td>${escapeHtml(historia.planTrabajo)}</td>
        </tr>
      `)}
    </tbody>
  </table>

  <h2>Actividad</h2>
  <table>
    <thead>
      <tr><th>Fecha</th><th>Estacion</th><th>Accion</th><th>Sujeto</th><th>Paciente</th><th>Usuario</th><th>Campos</th></tr>
    </thead>
    <tbody>
      ${renderRows(data.actividades, (actividad) => `
        <tr>
          <td>${escapeHtml(actividad.fecha)}</td>
          <td>${escapeHtml(actividad.estacion)}</td>
          <td>${escapeHtml(actividad.accion)}</td>
          <td>${escapeHtml(actividad.sujeto)}</td>
          <td>${escapeHtml(actividad.paciente.nombreCompleto)}<br><span class="muted">${escapeHtml(actividad.paciente.documento)}</span></td>
          <td>${escapeHtml(actividad.actor.nombre)}<br><span class="muted">${escapeHtml(actividad.actor.email)}</span></td>
          <td>${escapeHtml(actividad.cambios.join(", "))}</td>
        </tr>
      `)}
    </tbody>
  </table>
</body>
</html>`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await buildViajeReportData(decodeURIComponent(id));

  if (!data) {
    return Response.json({ message: "Viaje no encontrado." }, { status: 404 });
  }

  const fileName = `reporte-viaje-${getFileName(data.viaje.servicio || data.viaje.id)}.html`;

  return new Response(renderReportHtml(data), {
    headers: {
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
