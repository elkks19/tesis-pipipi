import type { DocenteReportOptions } from "./docente-report-options";
import { reportPeriodLabel, type ReportDateRange } from "./report-filters";
import { addInstitutionalHeader, addPaginatedPdfTable, addPdfText, buildSimplePdf, createSimplePdfPage, wrapPdfTextToWidth, type SimplePdfPage } from "./simple-pdf";

export function renderDocenteReportPdf(options: DocenteReportOptions, generatedBy: string, studentId?: string, range: ReportDateRange = {}) {
  const student = options.students.find((item) => item.id === studentId);
  const visits = studentId ? options.visits.filter((visit) => visit.authorIds.includes(studentId)) : options.visits;
  const pages: SimplePdfPage[] = [];
  const date = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date());
  addPaginatedPdfTable(
    ["Paciente", "Documento", "Fecha de atención", "Estado", options.stationKey === "farmacia" ? "Dispensado por" : "Registrado por"],
    [145, 78, 78, 64, 146],
    visits.length ? visits.map((visit) => [visit.name, visit.document, visit.date && !Number.isNaN(Date.parse(visit.date)) ? new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(visit.date)) : "Sin fecha", visit.completed ? "Completado" : "Pendiente", visit.author]) : [["Sin atenciones para este alcance", "", "", "", ""]],
    () => {
      const page = createSimplePdfPage();
      pages.push(page);
      let y = addInstitutionalHeader(page, `Reporte de ${options.stationLabel}`) - 8;
      for (const text of [
        student ? `Individual por estudiante: ${student.name}` : "Global de la estación",
        `${options.tripLabel} | ${options.establishment}`,
        `Período: ${reportPeriodLabel(range)} (fecha de atención, Bolivia)`,
        `Generado en: ${date} | Solicitado por: ${generatedBy}`,
        `Atenciones: ${visits.length} | Completadas: ${visits.filter((visit) => visit.completed).length} | Pendientes: ${visits.filter((visit) => !visit.completed).length}`,
      ]) {
        for (const line of wrapPdfTextToWidth(text, 511, 9)) {
          addPdfText(page, line, 42, y, 9);
          y -= 13;
        }
      }
      return { page, y: y - 10 };
    },
  );
  return buildSimplePdf(pages);
}
