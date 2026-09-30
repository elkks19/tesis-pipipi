import { prepareClinicalReportImage } from "@/lib/reports/clinical-report-image";
import { z } from "zod";
import { getDocenteReportData } from "@/lib/reports/docente-report-data";
import { renderDocenteReportPdf } from "@/lib/reports/docente-report-pdf";
import { renderStationClinicalPdf, renderPatientStationClinicalPdf } from "@/lib/reports/historia-clinica-pdf";
import { reportDateFields, reportDateRangeSchema, reportPeriodLabel, withinReportDates } from "@/lib/reports/report-filters";
import { reportStationSlugs } from "@/lib/reports/docente-report-options";
import type { StationKey } from "@/lib/station-histories";

const selectionSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("global"), ...reportDateFields }).strict(),
  z.object({ scope: z.literal("estudiante"), id: z.string().min(1).max(300), ...reportDateFields }).strict(),
  z.object({ scope: z.literal("atencion"), id: z.string().min(1).max(300), detail: z.enum(["station", "complete"]).default("station"), ...reportDateFields }).strict(),
  z.object({ scope: z.literal("paciente"), id: z.string().min(1).max(300), detail: z.enum(["station", "complete"]).default("station"), ...reportDateFields }).strict(),
]);

export async function handleStationReport(request: Request, stationKey: StationKey) {
  const selection = selectionSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!selection.success) return Response.json({ message: "Selecciona un alcance y un registro válidos." }, { status: 400 });
  const range = reportDateRangeSchema.safeParse({ from: selection.data.from, to: selection.data.to });
  if (!range.success) return Response.json({ message: range.error.issues[0].message }, { status: 400 });
  const data = await getDocenteReportData(stationKey, "detail" in selection.data && selection.data.detail === "complete");
  if (!data) return Response.json({ message: "No tienes una asignación activa en esta estación." }, { status: 403 });
  const { scope } = selection.data;
  const options = { ...data.options, visits: data.options.visits.filter((visit) => withinReportDates(visit.date, range.data)) };
  const period = reportPeriodLabel(range.data);
  let pdf: ArrayBuffer;
  if (scope === "paciente") {
    const complete = selection.data.detail === "complete";
    const patientId = selection.data.id;
    const visits = options.visits.filter((visit) => visit.patientId === patientId);
    if (!visits.length) return Response.json({ message: "No hay atenciones autorizadas de ese paciente en el período seleccionado." }, { status: 404 });
    const entries = visits.flatMap((visit) => {
      const record = data.records.find((item) => item.historia._id === visit.id);
      if (!record) return [];
      return [{ data: {
        generatedAt: new Date().toISOString(), generatedBy: data.generatedBy,
        userNames: Object.fromEntries([...data.users].map(([id, user]) => [id, user.name])), deliveries: record.deliveries,
        historia: record.historia, paciente: data.patients.get(patientId) ?? null,
        receta: record.receta ? { ...record.receta, _id: record.receta._id ?? record.receta.id } : null,
      }, registeredBy: complete ? data.users.get(record.historia.created_by ?? record.historia.anamnesis?.created_by ?? "")?.name ?? "Sin autor original registrado" : visit.author }];
    });
    const prepared = [];
    for (const entry of entries) prepared.push({ ...entry, data: complete || stationKey === "ecografia" ? await prepareClinicalReportImage(entry.data) : entry.data });
    pdf = renderPatientStationClinicalPdf(prepared, stationKey, data.options.stationLabel, period, complete);
  } else if (scope === "atencion") {
    const id = selection.data.id;
    const record = data.records.find((item) => item.historia._id === id);
    const visit = options.visits.find((item) => item.id === id);
    if (!record || !visit) return Response.json({ message: "La atención no pertenece a tu estación y viaje." }, { status: 404 });
    let clinicalData: import("@/lib/reports/historia-clinica-pdf").HistoriaClinicalPdfData = {
      generatedAt: new Date().toISOString(), generatedBy: data.generatedBy,
      userNames: Object.fromEntries([...data.users].map(([id, user]) => [id, user.name])), deliveries: record.deliveries,
        historia: record.historia, paciente: data.patients.get(record.historia.pacienteId) ?? null,
      receta: record.receta ? { ...record.receta, _id: record.receta._id ?? record.receta.id } : null,
    };
    if (selection.data.detail === "complete" || stationKey === "ecografia") clinicalData = await prepareClinicalReportImage(clinicalData);
    pdf = selection.data.detail === "complete"
      ? renderPatientStationClinicalPdf([{ data: clinicalData, registeredBy: data.users.get(record.historia.created_by ?? record.historia.anamnesis?.created_by ?? "")?.name ?? "Sin autor original registrado" }], stationKey, data.options.stationLabel, period, true)
      : renderStationClinicalPdf(clinicalData, stationKey, data.options.stationLabel, visit.author, period);
  } else {
    const id = scope === "estudiante" ? selection.data.id : undefined;
    if (id && !data.options.students.some((student) => student.id === id)) return Response.json({ message: "El estudiante no está asignado a esta estación." }, { status: 404 });
    pdf = renderDocenteReportPdf(options, data.generatedBy, id, range.data);
  }
  return new Response(pdf, { headers: {
    "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="reporte-${reportStationSlugs[stationKey]}-${scope}.pdf"`,
    "X-Content-Type-Options": "nosniff",
  } });
}
