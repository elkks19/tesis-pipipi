import type { ActivityListItem } from "@/lib/activity-queries";
import type { StationKey } from "@/lib/station-histories";

export type ActivityMode = "docente" | "estudiante";

export type ActivityListRow = ActivityListItem & {
  editHref?: string;
  reportHref?: string;
};

const stationLabels: Record<StationKey, string> = {
  anamnesis: "anamnesis",
  diagnostico: "diagnostico",
  ecografia: "ecografia",
  electrocardiograma: "electrocardiograma",
  espirometria: "espirometria",
  examenFisicoGeneral: "examen fisico general",
  examenFisicoSegmentario: "examen fisico segmentario",
  laboratorios: "laboratorios",
};

function getStationBasePath(basePath: string) {
  return basePath.endsWith("/actividad")
    ? basePath.slice(0, -"/actividad".length)
    : basePath;
}

export function getActivityTitle({
  mode,
  stationKey,
}: {
  mode: ActivityMode;
  stationKey: StationKey;
}) {
  const label = stationLabels[stationKey];

  if (mode === "estudiante") {
    return `Lo que registraste en ${label}`;
  }

  return `Movimiento del viaje en ${label}`;
}

export function getActivityDescription(mode: ActivityMode) {
  if (mode === "estudiante") {
    return "Aqui veras los cambios que guardaste durante el viaje activo.";
  }

  return "Aqui veras los cambios que se guardaron durante el viaje activo.";
}

export function getActivityEmptyCopy(mode: ActivityMode) {
  if (mode === "estudiante") {
    return "Cuando guardes cambios en esta estacion, apareceran aqui.";
  }

  return "Cuando se guarden cambios en esta estacion, apareceran aqui.";
}

export function getActivityEditHref({
  basePath,
  historiaId,
  mode,
  pacienteId,
  subject,
  stationKey,
}: {
  basePath: string;
  historiaId?: string;
  mode: ActivityMode;
  pacienteId: string;
  subject: "historia" | "paciente";
  stationKey: StationKey;
}) {
  const stationBasePath = getStationBasePath(basePath);

  if (subject === "paciente" && stationKey === "anamnesis") {
    return `${stationBasePath}/pacientes/${encodeURIComponent(pacienteId)}/edit`;
  }

  if (mode === "docente" && historiaId) {
    return `${stationBasePath}/${encodeURIComponent(historiaId)}`;
  }

  return undefined;
}

export function getActivityReportHref(
  historia?: ActivityListItem["historia"],
) {
  return historia?.reporteHistoria?.url;
}

export function withActivityLinks({
  basePath,
  mode,
  rows,
  stationKey,
}: {
  basePath: string;
  mode: ActivityMode;
  rows: ActivityListItem[];
  stationKey: StationKey;
}): ActivityListRow[] {
  return rows.map((row) => ({
    ...row,
    editHref: getActivityEditHref({
      basePath,
      historiaId: row.historiaId,
      mode,
      pacienteId: row.pacienteId,
      stationKey,
      subject: row.subject,
    }),
    reportHref: getActivityReportHref(row.historia),
  }));
}
