import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { Viaje } from "@/lib/schema/viajes";

export type ActiveStudentTrip = {
  basePath?: string;
  estacionTipo: string;
  establecimiento: string;
  fechaEntrada: string;
  fechaSalida: string;
  redirectTo?: string;
  servicio: string;
  viajeId: string;
};

export type FutureStudentTrip = {
  estacionTipo?: string;
  establecimiento: string;
  fechaEntrada: string;
  fechaSalida: string;
  servicio: string;
  viajeId: string;
};

export type StudentTripResolution = {
  activeTrip?: ActiveStudentTrip;
  futureTrip?: FutureStudentTrip;
  futureTrips?: FutureStudentTrip[];
  redirectTo?: string;
};

type ViajeDocument = PouchDB.Core.ExistingDocument<Viaje>;

const stationRoutes: Record<string, string> = {
  Anamnesis: "/estudiante/anamnesis/create-historia",
  "Examen Físico General": "/estudiante/examen-fisico-general",
  "Examen Físico Segmentario": "/estudiante/examen-fisico-segmentario",
  Ecografía: "/estudiante/ecografia",
  Electrocardiograma: "/estudiante/electrocardiograma",
  Espirometría: "/estudiante/espirometria",
  Farmacia: "/estudiante/farmacia",
  Laboratorios: "/estudiante/laboratorios",
  Diagnóstico: "/estudiante/diagnostico",
};

const docenteStationRoutes: Record<string, string> = {
  Anamnesis: "/docente/anamnesis/create-historia",
  "Examen Físico General": "/docente/examen-fisico-general",
  "Examen Físico Segmentario": "/docente/examen-fisico-segmentario",
  Ecografía: "/docente/ecografia",
  Electrocardiograma: "/docente/electrocardiograma",
  Espirometría: "/docente/espirometria",
  Farmacia: "/docente/farmacia",
  Laboratorios: "/docente/laboratorios",
  Diagnóstico: "/docente/diagnostico",
};

const stationBasePaths: Record<string, string> = {
  Anamnesis: "/estudiante/anamnesis",
  "Examen Físico General": "/estudiante/examen-fisico-general",
  "Examen Físico Segmentario": "/estudiante/examen-fisico-segmentario",
  Ecografía: "/estudiante/ecografia",
  Electrocardiograma: "/estudiante/electrocardiograma",
  Espirometría: "/estudiante/espirometria",
  Farmacia: "/estudiante/farmacia",
  Laboratorios: "/estudiante/laboratorios",
  Diagnóstico: "/estudiante/diagnostico",
};

const docenteStationBasePaths: Record<string, string> = {
  Anamnesis: "/docente/anamnesis",
  "Examen Físico General": "/docente/examen-fisico-general",
  "Examen Físico Segmentario": "/docente/examen-fisico-segmentario",
  Ecografía: "/docente/ecografia",
  Electrocardiograma: "/docente/electrocardiograma",
  Espirometría: "/docente/espirometria",
  Farmacia: "/docente/farmacia",
  Laboratorios: "/docente/laboratorios",
  Diagnóstico: "/docente/diagnostico",
};

function isViaje(doc: unknown): doc is ViajeDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viaje" &&
    "fechaEntrada" in doc &&
    "fechaSalida" in doc &&
    "estaciones" in doc &&
    Array.isArray(doc.estaciones)
  );
}

function getTodayValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/La_Paz",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${value.year}-${value.month}-${value.day}`;
}

function isActive(viaje: ViajeDocument, today: string) {
  return viaje.fechaEntrada <= today && viaje.fechaSalida >= today;
}

function isFuture(viaje: ViajeDocument, today: string) {
  return viaje.fechaEntrada > today;
}

function getStudentStation(viaje: ViajeDocument, userId: string) {
  return viaje.estaciones.find((estacion) =>
    estacion.estudiantesIds.includes(userId),
  );
}

function getDocenteStation(viaje: ViajeDocument, userId: string) {
  return viaje.estaciones.find(
    (estacion) => estacion.docenteEncargadoId === userId,
  );
}

async function listViajes() {
  await ensureTesisIndexes();

  const result = await findTesisDocs({
    limit: 500,
    selector: {
      type: "viaje",
    },
    use_index: "idx_type",
  });

  return result.docs
    .filter(isViaje)
    .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada));
}

function toFutureTrip(
  viaje: ViajeDocument,
  estacionTipo?: string,
): FutureStudentTrip {
  return {
    estacionTipo,
    establecimiento: viaje.establecimiento.nombre,
    fechaEntrada: viaje.fechaEntrada,
    fechaSalida: viaje.fechaSalida,
    servicio: viaje.servicio,
    viajeId: viaje._id ?? viaje.id,
  };
}

function toActiveTrip(
  viaje: ViajeDocument,
  estacionTipo: string,
  mode: "docente" | "estudiante" = "estudiante",
): ActiveStudentTrip {
  const routes = mode === "docente" ? docenteStationRoutes : stationRoutes;
  const basePaths =
    mode === "docente" ? docenteStationBasePaths : stationBasePaths;

  return {
    basePath: basePaths[estacionTipo],
    estacionTipo,
    establecimiento: viaje.establecimiento.nombre,
    fechaEntrada: viaje.fechaEntrada,
    fechaSalida: viaje.fechaSalida,
    redirectTo: routes[estacionTipo],
    servicio: viaje.servicio,
    viajeId: viaje._id ?? viaje.id,
  };
}

async function resolveTripRoute({
  mode,
  userId,
}: {
  mode: "docente" | "estudiante";
  userId: string | undefined;
}): Promise<StudentTripResolution> {
  if (!userId) {
    return {};
  }

  const today = getTodayValue();
  const viajes = await listViajes();
  const getStation = mode === "docente" ? getDocenteStation : getStudentStation;
  const assignedTrips = viajes
    .map((viaje) => ({
      estacion: getStation(viaje, userId),
      viaje,
    }))
    .filter((item) => Boolean(item.estacion));
  const activeAssignment = assignedTrips.find((item) =>
    isActive(item.viaje, today),
  );

  if (activeAssignment?.estacion) {
    const activeTrip = toActiveTrip(
      activeAssignment.viaje,
      activeAssignment.estacion.tipo,
      mode,
    );

    return {
      activeTrip,
      redirectTo: activeTrip.redirectTo,
    };
  }

  const futureAssignments = assignedTrips.filter((item) =>
    isFuture(item.viaje, today),
  );
  const futureTrips = futureAssignments.map((item) =>
    toFutureTrip(item.viaje, item.estacion?.tipo),
  );

  return {
    futureTrip: futureTrips[0],
    futureTrips,
  };
}

export async function resolveStudentTripRoute(
  userId: string | undefined,
): Promise<StudentTripResolution> {
  return resolveTripRoute({ mode: "estudiante", userId });
}

export async function resolveDocenteTripRoute(userId: string | undefined) {
  return resolveTripRoute({ mode: "docente", userId });
}
