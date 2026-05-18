import type { StationKey } from "@/lib/station-histories";

export type ActividadSubject = "historia" | "paciente";
export type ActividadAction = "created" | "updated";

export type ActividadChange = {
  after?: unknown;
  before?: unknown;
  field: string;
};

export type Actividad = {
  type: "actividad";
  action: ActividadAction;
  changes?: ActividadChange[];
  actorId: string;
  changedFields: string[];
  createdAt: string;
  historiaId?: string;
  pacienteId: string;
  stationKey: StationKey;
  subject: ActividadSubject;
  viajeId: string;
};
