import { z } from "zod";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica una fecha válida.").refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Indica una fecha válida.");

export const reportDateFields = { from: calendarDate.optional(), to: calendarDate.optional() };
export type ReportDateRange = { from?: string; to?: string };
export const reportDateRangeSchema = z.object(reportDateFields).refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: "La fecha inicial no puede ser posterior a la final.", path: ["from"] },
);

export function reportLocalDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/La_Paz" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function withinReportDates(value: string, { from, to }: ReportDateRange) {
  if (!from && !to) return true;
  const date = reportLocalDate(value);
  return Boolean(date) && (!from || date >= from) && (!to || date <= to);
}

export function reportPeriodLabel({ from, to }: ReportDateRange) {
  const format = (date: string) => date.split("-").reverse().join("/");
  if (from && to) return `${format(from)} al ${format(to)}`;
  if (from) return `Desde ${format(from)}`;
  if (to) return `Hasta ${format(to)}`;
  return "Todas las fechas disponibles";
}
