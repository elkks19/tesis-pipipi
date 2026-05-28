import "server-only";

import { getAuthUsersByIds } from "@/lib/auth-users";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { Actividad, Historia } from "@/lib/schema";
import { resolveDocenteTripRoute } from "@/lib/student-trip-resolution";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

import { getViajeByDocId } from "@/app/admin/viajes/queries";
import type { ViajeListItem } from "@/app/admin/viajes/queries";

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;
type ActividadDocument = PouchDB.Core.ExistingDocument<Actividad>;

type StationAuditValue = {
  created_by?: string;
  updated_by?: string;
};

type PerformanceTrip = {
  estacionTipo: string;
  establecimiento: string;
  fechaEntrada: string;
  fechaSalida: string;
  servicio: string;
  viajeId: string;
};

function isHistoria(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia"
  );
}

function isActividad(doc: unknown): doc is ActividadDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "actividad"
  );
}

function getStationAudit(historia: HistoriaDocument, stationKey: StationKey) {
  const field = stationConfigs[stationKey].field;
  const value = historia[field];

  return typeof value === "object" && value !== null
    ? (value as StationAuditValue)
    : undefined;
}

function wasStationRequested(historia: HistoriaDocument, stationKey: StationKey) {
  const config = stationConfigs[stationKey];

  if (!("complementaryKey" in config)) {
    return true;
  }

  return Boolean(
    historia.examenesComplementariosSolicitados?.[config.complementaryKey],
  );
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
}

function topPerformer<Row extends {
    id: string;
    name: string;
  }>(
  rows: Row[],
  getValue: (row: Row) => number,
) {
  const top = rows
    .map((row) => ({
      count: getValue(row),
      id: row.id,
      name: row.name,
    }))
    .sort((a, b) => b.count - a.count)[0];

  if (!top || top.count <= 0) {
    return null;
  }

  return top;
}

function toPerformanceTrip(
  viaje: ViajeListItem,
  stationLabel: string,
): PerformanceTrip {
  return {
    estacionTipo: stationLabel,
    establecimiento: viaje.establecimiento.nombre,
    fechaEntrada: viaje.fechaEntrada,
    fechaSalida: viaje.fechaSalida,
    servicio: viaje.servicio,
    viajeId: viaje.docId,
  };
}

export async function getStationPerformanceForTrip({
  stationKey,
  viajeId,
}: {
  stationKey: StationKey;
  viajeId: string;
}) {
  await ensureTesisIndexes();

  const config = stationConfigs[stationKey];
  const viaje = await getViajeByDocId(viajeId);
  const station = viaje?.estaciones.find(
    (estacion) => estacion.tipo === config.viajeTipo,
  );

  if (!viaje || !station) {
    return null;
  }

  const activeTrip = toPerformanceTrip(viaje, config.viajeTipo);

  const [historiesResult, activitiesResult] = await Promise.all([
    findTesisDocs({
      limit: 10_000,
      selector: {
        type: "historia",
        viajeId: viaje.docId,
      },
    }),
    findTesisDocs({
      limit: 10_000,
      selector: {
        stationKey,
        type: "actividad",
        viajeId: viaje.docId,
      },
    }),
  ]);
  const histories = historiesResult.docs.filter(isHistoria);
  const activities = activitiesResult.docs.filter(isActividad);
  const requestedHistories = histories.filter((historia) =>
    wasStationRequested(historia, stationKey),
  );
  const completedHistories = requestedHistories.filter((historia) =>
    Boolean(getStationAudit(historia, stationKey)),
  );
  const actorIds = [
    ...new Set([
      ...station.estudiantesIds,
      ...activities.map((activity) => activity.actorId).filter(Boolean),
    ]),
  ];
  const usersById = getAuthUsersByIds(actorIds);
  const rows = actorIds
    .map((actorId) => {
      const student = usersById.get(actorId);
      const studentActivities = activities.filter(
        (activity) => activity.actorId === actorId,
      );
      const stationCreated = completedHistories.filter(
        (historia) => getStationAudit(historia, stationKey)?.created_by === actorId,
      );
      const stationUpdated = completedHistories.filter(
        (historia) => getStationAudit(historia, stationKey)?.updated_by === actorId,
      );
      const touchedHistoryIds = new Set([
        ...studentActivities
          .map((activity) => activity.historiaId)
          .filter((id): id is string => Boolean(id)),
        ...stationCreated.map((historia) => historia._id).filter(Boolean),
        ...stationUpdated.map((historia) => historia._id).filter(Boolean),
      ]);
      const createdActivities = studentActivities.filter(
        (activity) => activity.action === "created",
      ).length;
      const updatedActivities = studentActivities.filter(
        (activity) => activity.action === "updated",
      ).length;
      const historyCreatedActivities = studentActivities.filter(
        (activity) =>
          activity.action === "created" && activity.subject === "historia",
      ).length;
      const patientCreatedActivities = studentActivities.filter(
        (activity) =>
          activity.action === "created" && activity.subject === "paciente",
      ).length;
      const dataUpdatedActivities = studentActivities.filter(
        (activity) => activity.action === "updated",
      ).length;
      const lastActivityAt = studentActivities
        .map((activity) => activity.createdAt)
        .sort((a, b) => b.localeCompare(a))[0];

      return {
        completionShare: formatPercent(
          (stationCreated.length / Math.max(1, completedHistories.length)) * 100,
        ),
        createdActivities,
        dataUpdatedActivities,
        email: student?.email ?? "",
        historyCreatedActivities,
        id: actorId,
        isAssignedStudent: station.estudiantesIds.includes(actorId),
        lastActivityAt,
        name: student?.name ?? actorId,
        patientCreatedActivities,
        registered: stationCreated.length,
        role: student?.role ?? null,
        touchedHistories: touchedHistoryIds.size,
        totalActivities: studentActivities.length,
        updated: stationUpdated.length,
        updatedActivities,
      };
    })
    .sort((a, b) => {
      const byRegistered = b.registered - a.registered;

      if (byRegistered !== 0) {
        return byRegistered;
      }

      return b.totalActivities - a.totalActivities;
    });
  const historiesCreated = activities.filter(
    (activity) => activity.action === "created" && activity.subject === "historia",
  ).length;
  const patientsCreated = activities.filter(
    (activity) => activity.action === "created" && activity.subject === "paciente",
  ).length;
  const dataUpdates = activities.filter(
    (activity) => activity.action === "updated",
  ).length;

  return {
    activeTrip,
    rows,
    station: {
      key: stationKey,
      label: config.viajeTipo,
    },
    summary: {
      dataUpdates,
      historiesCreated,
      patientsCreated,
      topDataUpdater: topPerformer(
        rows,
        (row) => row.dataUpdatedActivities,
      ),
      topHistoryCreator: topPerformer(
        rows,
        (row) => row.historyCreatedActivities,
      ),
      topPatientCreator: topPerformer(
        rows,
        (row) => row.patientCreatedActivities,
      ),
      completionRate: formatPercent(
        (completedHistories.length / Math.max(1, requestedHistories.length)) * 100,
      ),
      completed: completedHistories.length,
      requested: requestedHistories.length,
      students: rows.length,
      totalActivities: activities.length,
      updates: activities.filter((activity) => activity.action === "updated").length,
    },
  };
}

export async function getDocenteStationPerformance(stationKey: StationKey) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const activeTrip = await resolveDocenteTripRoute(user.id).then(
    (result) => result.activeTrip,
  );
  const config = stationConfigs[stationKey];

  if (!activeTrip || activeTrip.estacionTipo !== config.viajeTipo) {
    return null;
  }

  return getStationPerformanceForTrip({
    stationKey,
    viajeId: activeTrip.viajeId,
  });
}

export type DocenteStationPerformance = NonNullable<
  Awaited<ReturnType<typeof getStationPerformanceForTrip>>
>;
