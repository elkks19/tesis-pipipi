import type { StationKey } from "@/lib/station-histories";

export const reportStationSlugs: Record<StationKey, string> = {
  anamnesis: "anamnesis", diagnostico: "diagnostico", ecografia: "ecografia",
  electrocardiograma: "electrocardiograma", espirometria: "espirometria",
  examenFisicoGeneral: "examen-fisico-general", examenFisicoSegmentario: "examen-fisico-segmentario",
  farmacia: "farmacia", laboratorios: "laboratorios",
};

export type DocenteReportOptions = {
  stationKey: StationKey;
  stationLabel: string;
  tripLabel: string;
  establishment: string;
  students: { id: string; name: string }[];
  visits: { id: string; patientId: string; name: string; document: string; date: string; author: string; completed: boolean; authorIds: string[] }[];
};
