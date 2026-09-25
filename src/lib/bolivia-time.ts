const monthNames = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sept", "oct", "nov", "dic",
] as const;

export function formatBoliviaActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/La_Paz",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour);
  const month = monthNames[Number(values.month) - 1];
  if (!month || !Number.isFinite(hour)) return "Fecha no disponible";

  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "a. m." : "p. m.";
  return `${Number(values.day)} ${month} de ${values.year}, ${displayHour}:${values.minute} ${period}`;
}
