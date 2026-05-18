import "server-only";

import { getAuthUsersByIds } from "@/lib/auth-users";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { Actividad, Historia } from "@/lib/schema";
import { resolveDocenteTripRoute } from "@/lib/student-trip-resolution";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

import { getViajeByDocId } from "@/app/admin/viajes/queries";

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;
type ActividadDocument = PouchDB.Core.ExistingDocument<Actividad>;

type StationAuditValue = {
  created_by?: string;
  updated_by?: string;
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

export async function getDocenteStationPerformance(stationKey: StationKey) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  await ensureTesisIndexes();

  const activeTrip = await resolveDocenteTripRoute(user.id).then(
    (result) => result.activeTrip,
  );
  const config = stationConfigs[stationKey];

  if (!activeTrip || activeTrip.estacionTipo !== config.viajeTipo) {
    return {
      activeTrip: null,
      rows: [],
      station: {
        key: stationKey,
        label: config.viajeTipo,
      },
      summary: {
        completionRate: 0,
        completed: 0,
        requested: 0,
        students: 0,
        totalActivities: 0,
        updates: 0,
      },
    };
  }

  const viaje = await getViajeByDocId(activeTrip.viajeId);
  const station = viaje?.estaciones.find(
    (estacion) => estacion.tipo === config.viajeTipo,
  );

  if (!viaje || !station) {
    return null;
  }

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
  const usersById = getAuthUsersByIds(station.estudiantesIds);
  const rows = station.estudiantesIds
    .map((studentId) => {
      const student = usersById.get(studentId);
      const studentActivities = activities.filter(
        (activity) => activity.actorId === studentId,
      );
      const stationCreated = completedHistories.filter(
        (historia) => getStationAudit(historia, stationKey)?.created_by === studentId,
      );
      const stationUpdated = completedHistories.filter(
        (historia) => getStationAudit(historia, stationKey)?.updated_by === studentId,
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
      const lastActivityAt = studentActivities
        .map((activity) => activity.createdAt)
        .sort((a, b) => b.localeCompare(a))[0];

      return {
        completionShare: formatPercent(
          (stationCreated.length / Math.max(1, completedHistories.length)) * 100,
        ),
        createdActivities,
        email: student?.email ?? "",
        id: studentId,
        lastActivityAt,
        name: student?.name ?? studentId,
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

  return {
    activeTrip,
    rows,
    station: {
      key: stationKey,
      label: config.viajeTipo,
    },
    summary: {
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
