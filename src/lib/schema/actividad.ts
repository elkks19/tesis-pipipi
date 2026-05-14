import type { StationKey } from "@/lib/station-histories";

export type ActividadSubject = "historia" | "paciente";
export type ActividadAction = "created" | "updated";

export type Actividad = {
  type: "actividad";
  action: ActividadAction;
  actorId: string;
  changedFields: string[];
  createdAt: string;
  historiaId?: string;
  pacienteId: string;
  stationKey: StationKey;
  subject: ActividadSubject;
  viajeId: string;
};
