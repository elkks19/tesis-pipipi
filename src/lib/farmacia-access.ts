import type { Viaje } from "@/lib/schema";

export type FarmaciaAccessMode = "docente" | "estudiante";
export type FarmaciaAccessPhase = "sin_acceso" | "planeacion" | "activo" | "conciliacion" | "cerrado";
export type FarmaciaPermission = "read" | "plan" | "operate" | "adjust";

function laPazDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: "America/La_Paz", year: "numeric" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00-04:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getFarmaciaAccessPhase(viaje: Pick<Viaje, "fechaEntrada" | "fechaSalida">, now = new Date()): FarmaciaAccessPhase {
  const today = laPazDateParts(now);
  if (today < addDays(viaje.fechaEntrada, -7)) return "sin_acceso";
  if (today < viaje.fechaEntrada) return "planeacion";
  if (today <= viaje.fechaSalida) return "activo";
  if (today <= addDays(viaje.fechaSalida, 1)) return "conciliacion";
  return "cerrado";
}

export function canPerformFarmaciaAction({ mode, permission, phase }: { mode: FarmaciaAccessMode; permission: FarmaciaPermission; phase: FarmaciaAccessPhase }) {
  if (phase === "sin_acceso") return false;
  if (permission === "read") return true;
  if (permission === "plan") return phase === "planeacion" || phase === "activo";
  if (permission === "operate") return phase === "activo";
  return mode === "docente" && (phase === "activo" || phase === "conciliacion");
}

export function getLaPazDateValue(date = new Date()) {
  return laPazDateParts(date);
}
