import "server-only";

import { db } from "@/lib/db";
import type { Actividad, ActividadAction } from "@/lib/schema/actividad";
import type { Historia } from "@/lib/schema/historia";
import {
  resolveDocenteTripRoute,
  resolveStudentTripRoute,
  type StudentTripResolution,
} from "@/lib/student-trip-resolution";
import type { StationKey } from "@/lib/station-histories";

type HistoriaDocument = Historia & {
  _id?: string;
};

type LogStationActivityInput = {
  actorId: string;
  after: unknown;
  before: unknown;
  historia: HistoriaDocument;
  stationKey: StationKey;
};

type LogPacienteActivityInput = {
  actorId: string;
  after: unknown;
  before?: unknown;
  pacienteId: string;
};

const ignoredDiffFields = new Set(["created_by", "updated_by"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flatten(value: unknown, prefix = ""): Map<string, unknown> {
  const fields = new Map<string, unknown>();

  if (!isRecord(value)) {
    if (prefix) {
      fields.set(prefix, value);
    }

    return fields;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (ignoredDiffFields.has(key)) {
      continue;
    }

    const path = prefix ? `${prefix}.${key}` : key;

    if (isRecord(nestedValue)) {
      const nestedFields = flatten(nestedValue, path);

      for (const [nestedPath, nestedLeafValue] of nestedFields) {
        fields.set(nestedPath, nestedLeafValue);
      }
    } else {
      fields.set(path, nestedValue);
    }
  }

  return fields;
}

function valuesAreEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getChangedFields(before: unknown, after: unknown) {
  const beforeFields = flatten(before);
  const afterFields = flatten(after);
  const keys = new Set([...beforeFields.keys(), ...afterFields.keys()]);

  return [...keys]
    .filter((key) => !valuesAreEqual(beforeFields.get(key), afterFields.get(key)))
    .sort();
}

function getAction(before: unknown): ActividadAction {
  return before ? "updated" : "created";
}

function getActivityId(createdAt: string) {
  return `actividad:${createdAt}:${crypto.randomUUID()}`;
}

async function putActivity(activity: Actividad) {
  await db.put({
    _id: getActivityId(activity.createdAt),
    ...activity,
  });
}

export async function resolveActiveViajeForUser(actorId: string) {
  const [studentResolution, docenteResolution] = await Promise.all([
    resolveStudentTripRoute(actorId).catch(
      (): StudentTripResolution => ({}),
    ),
    resolveDocenteTripRoute(actorId).catch(
      (): StudentTripResolution => ({}),
    ),
  ]);

  return studentResolution.activeTrip ?? docenteResolution.activeTrip;
}

export async function logStationActivity({
  actorId,
  after,
  before,
  historia,
  stationKey,
}: LogStationActivityInput) {
  if (!historia._id || !historia.viajeId) {
    return;
  }

  const changedFields = getChangedFields(before, after);

  await putActivity({
    type: "actividad",
    action: getAction(before),
    actorId,
    changedFields,
    createdAt: new Date().toISOString(),
    historiaId: historia._id,
    pacienteId: historia.pacienteId,
    stationKey,
    subject: "historia",
    viajeId: historia.viajeId,
  });
}

export async function logPacienteActivity({
  actorId,
  after,
  before,
  pacienteId,
}: LogPacienteActivityInput) {
  const activeTrip = await resolveActiveViajeForUser(actorId);

  if (!activeTrip?.viajeId) {
    return;
  }

  await putActivity({
    type: "actividad",
    action: getAction(before),
    actorId,
    changedFields: getChangedFields(before, after),
    createdAt: new Date().toISOString(),
    pacienteId,
    stationKey: "anamnesis",
    subject: "paciente",
    viajeId: activeTrip.viajeId,
  });
}
