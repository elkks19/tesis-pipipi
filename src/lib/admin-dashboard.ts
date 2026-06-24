import "server-only";

import { listViajes } from "@/app/admin/viajes/queries";
import { getAuthUsersByIds } from "@/lib/auth-users";
import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { Actividad, ActividadChange } from "@/lib/schema/actividad";
import type { DiagnosticoCie11 } from "@/lib/schema/diagnostico";
import type { Historia } from "@/lib/schema/historia";
import type { Paciente } from "@/lib/schema/pacientes";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

type ExistingHistoria = PouchDB.Core.ExistingDocument<Historia>;
type ExistingPaciente = PouchDB.Core.ExistingDocument<Paciente>;
type ExistingActividad = PouchDB.Core.ExistingDocument<Actividad>;

export type AdminDashboardTripOption = {
  dateLabel: string;
  id: string;
  label: string;
  secondaryLabel: string;
};

export type DiagnosisGenderRow = {
  genero: string;
  historias: number;
};

export type DiagnosisSummaryRow = {
  code?: string;
  genderRows: DiagnosisGenderRow[];
  historias: number;
  isOther?: boolean;
  label: string;
  members?: DiagnosisSummaryRow[];
  share: number;
};

export type AdminActivityLogRow = {
  action: Actividad["action"];
  actorEmail?: string;
  actorId: string;
  actorName: string;
  changes: ActividadChange[];
  changedFields: string[];
  createdAt: string;
  documentId: string;
  documentLabel: string;
  id: string;
  pacienteLabel: string;
  stationLabel: string;
  subject: Actividad["subject"];
  viajeId: string;
  viajeLabel?: string;
};

export type AdminActivityActorOption = {
  email?: string;
  id: string;
  name: string;
};

export type AdminDashboardSummary = {
  activityActors: AdminActivityActorOption[];
  activityPage: AdminActivityLogPage;
  diagnosisRows: DiagnosisSummaryRow[];
  selectedTrip?: AdminDashboardTripOption;
  selectedTripId?: string;
  trips: AdminDashboardTripOption[];
};

export type AdminActivityLogPage = {
  hasNextPage: boolean;
  nextCursor?: string;
  rows: AdminActivityLogRow[];
};

export type AdminChangeStats = {
  changedHistories: number;
  changedPercent: number;
  multipleChangedHistories: number;
  multipleChangedPercent: number;
  totalHistories: number;
};

const DIAGNOSIS_THRESHOLD = 0.02;
export const ADMIN_ACTIVITY_PAGE_SIZE = 3;

export async function getAdminDashboardSummary(
  selectedTripId?: string,
): Promise<AdminDashboardSummary> {
  await ensureTesisIndexes();

  const trips = (await listViajes({}))
    .map(toTripOption)
    .sort((a, b) => b.dateLabel.localeCompare(a.dateLabel));
  const selectedTrip =
    trips.find((trip) => trip.id === selectedTripId) ?? trips[0];

  if (!selectedTrip) {
    return {
      activityActors: [],
      activityPage: {
        hasNextPage: false,
        rows: [],
      },
      diagnosisRows: [],
      trips: [],
    };
  }

  const historias = await fetchHistorias(selectedTrip.id);
  const pacientesById = await fetchPacientesById(
    historias.map((historia) => historia.pacienteId),
  );

  return {
    activityPage: await fetchActivityPage({
      limit: ADMIN_ACTIVITY_PAGE_SIZE,
      viajeId: selectedTrip.id,
    }),
    activityActors: await fetchActivityActorOptions(selectedTrip.id),
    diagnosisRows: buildDiagnosisRows(historias, pacientesById),
    selectedTrip,
    selectedTripId: selectedTrip.id,
    trips,
  };
}

function toTripOption(viaje: Awaited<ReturnType<typeof listViajes>>[number]) {
  return {
    dateLabel: `${formatDate(viaje.fechaEntrada)} - ${formatDate(viaje.fechaSalida)}`,
    id: viaje.docId,
    label: `${viaje.servicio} / ${viaje.establecimiento.nombre}`,
    secondaryLabel: viaje.establecimiento.direccion ?? "Sin direccion registrada",
  };
}

async function fetchHistorias(viajeId: string) {
  const result = await findTesisDocs({
    limit: 500,
    selector: {
      type: "historia",
      viajeId,
    },
    use_index: "idx_historias_viaje",
  });

  return result.docs.filter(isHistoria);
}

async function fetchPacientesById(pacienteIds: string[]) {
  const pacientes = new Map<string, ExistingPaciente>();
  const uniqueIds = [...new Set(pacienteIds.filter(Boolean))];

  await Promise.all(
    uniqueIds.map(async (pacienteId) => {
      try {
        const doc = await db.get(pacienteId);
        if (isPaciente(doc)) {
          pacientes.set(pacienteId, doc);
        }
      } catch {
        // El log debe seguir cargando aunque falte un paciente referenciado.
      }
    }),
  );

  return pacientes;
}

function buildDiagnosisRows(
  historias: ExistingHistoria[],
  pacientesById: Map<string, ExistingPaciente>,
) {
  const byDiagnosis = new Map<
    string,
    {
      code?: string;
      genderCounts: Map<string, number>;
      historias: number;
      label: string;
    }
  >();

  for (const historia of historias) {
    const paciente = pacientesById.get(historia.pacienteId);
    const genero = paciente?.genero ?? "Sin dato";

    for (const diagnosis of diagnosisItems(historia)) {
      const label = diagnosisLabel(diagnosis);
      if (!label) {
        continue;
      }

      const current =
        byDiagnosis.get(label) ??
        {
          code: diagnosis.code || diagnosis.iNo,
          genderCounts: new Map<string, number>(),
          historias: 0,
          label,
        };

      current.historias += 1;
      current.genderCounts.set(genero, (current.genderCounts.get(genero) ?? 0) + 1);
      byDiagnosis.set(label, current);
    }
  }

  const total = [...byDiagnosis.values()].reduce(
    (sum, row) => sum + row.historias,
    0,
  );
  const rows = [...byDiagnosis.values()]
    .map((row): DiagnosisSummaryRow => ({
      code: row.code,
      genderRows: [...row.genderCounts.entries()]
        .map(([genero, historias]) => ({ genero, historias }))
        .sort((a, b) => b.historias - a.historias),
      historias: row.historias,
      label: row.label,
      share: total > 0 ? row.historias / total : 0,
    }))
    .sort((a, b) => b.historias - a.historias);

  const visible = rows.filter((row) => row.share >= DIAGNOSIS_THRESHOLD);
  const otherMembers = rows.filter((row) => row.share < DIAGNOSIS_THRESHOLD);
  if (otherMembers.length === 0) {
    return visible;
  }

  return [
    ...visible,
    {
      genderRows: mergeGenderRows(otherMembers),
      historias: otherMembers.reduce((sum, row) => sum + row.historias, 0),
      isOther: true,
      label: "Otros",
      members: otherMembers,
      share: otherMembers.reduce((sum, row) => sum + row.share, 0),
    },
  ];
}

export async function fetchActivityPage({
  actorId,
  cursor,
  limit = ADMIN_ACTIVITY_PAGE_SIZE,
  viajeId,
}: {
  actorId?: string;
  cursor?: string;
  limit?: number;
  viajeId: string;
}): Promise<AdminActivityLogPage> {
  await ensureTesisIndexes();

  const selector: Record<string, unknown> = {
    createdAt: {
      $exists: true,
    },
    type: "actividad",
    viajeId,
  };

  if (actorId) {
    selector.actorId = actorId;
  }

  const result = await findTesisDocs({
    bookmark: cursor || undefined,
    limit,
    selector,
    sort: actorId
      ? [
          { type: "desc" },
          { viajeId: "desc" },
          { actorId: "desc" },
          { createdAt: "desc" },
        ]
      : [
          { type: "desc" },
          { viajeId: "desc" },
          { createdAt: "desc" },
        ],
    use_index: actorId
      ? "idx_actividades_viaje_actor_created"
      : "idx_actividades_viaje_created",
  });
  const resultActivities = result.docs.filter(isActividad);
  const activities = resultActivities;
  const [usersById, pacientesById] = await Promise.all([
    Promise.resolve(getAuthUsersByIds(activities.map((activity) => activity.actorId))),
    fetchPacientesById(activities.map((activity) => activity.pacienteId)),
  ]);

  return {
    hasNextPage: resultActivities.length === limit,
    nextCursor: resultActivities.length === limit ? result.bookmark : undefined,
    rows: activities.map((activity) =>
      serializeActivityRow(activity, usersById, pacientesById),
    ),
  };
}

export async function fetchChangeStats(
  viajeId: string,
): Promise<AdminChangeStats> {
  await ensureTesisIndexes();

  const [historias, activities] = await Promise.all([
    fetchAllHistorias(viajeId),
    fetchAllUpdatedActivities(viajeId),
  ]);
  const updateCountsByHistoria = new Map<string, number>();

  for (const activity of activities) {
    const historiaId = activity.historiaId;
    if (!historiaId) {
      continue;
    }

    updateCountsByHistoria.set(
      historiaId,
      (updateCountsByHistoria.get(historiaId) ?? 0) + 1,
    );
  }

  const totalHistories = historias.length;
  const changedHistories = updateCountsByHistoria.size;
  const multipleChangedHistories = [...updateCountsByHistoria.values()].filter(
    (count) => count > 1,
  ).length;

  return {
    changedHistories,
    changedPercent: percentage(changedHistories, totalHistories),
    multipleChangedHistories,
    multipleChangedPercent: percentage(multipleChangedHistories, totalHistories),
    totalHistories,
  };
}

async function fetchAllHistorias(viajeId: string) {
  const docs: ExistingHistoria[] = [];
  let bookmark: string | undefined;

  do {
    const result = await findTesisDocs({
      bookmark,
      limit: 500,
      selector: {
        type: "historia",
        viajeId,
      },
      use_index: "idx_historias_viaje",
    });

    docs.push(...result.docs.filter(isHistoria));
    bookmark = result.docs.length === 500 ? result.bookmark : undefined;
  } while (bookmark);

  return docs;
}

async function fetchAllUpdatedActivities(viajeId: string) {
  const docs: ExistingActividad[] = [];
  let bookmark: string | undefined;

  do {
    const result = await findTesisDocs({
      bookmark,
      limit: 500,
      selector: {
        action: "updated",
        type: "actividad",
        viajeId,
      },
      use_index: "idx_actividades_viaje_created",
    });

    docs.push(
      ...result.docs
        .filter(isActividad)
        .filter((activity) => activity.action === "updated"),
    );
    bookmark = result.docs.length === 500 ? result.bookmark : undefined;
  } while (bookmark);

  return docs;
}

async function fetchActivityActorOptions(viajeId: string) {
  const result = await findTesisDocs({
    limit: 500,
    selector: {
      type: "actividad",
      viajeId,
    },
    use_index: "idx_actividades_viaje_created",
  });
  const actorIds = [
    ...new Set(
      result.docs
        .filter(isActividad)
        .map((activity) => activity.actorId)
        .filter(Boolean),
    ),
  ];
  const usersById = getAuthUsersByIds(actorIds);

  return actorIds
    .map((actorId) => {
      const user = usersById.get(actorId);

      return {
        email: user?.email,
        id: actorId,
        name: user?.name ?? "Usuario no encontrado",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function serializeActivityRow(
  activity: ExistingActividad,
  usersById: ReturnType<typeof getAuthUsersByIds>,
  pacientesById: Map<string, ExistingPaciente>,
) {
  const actor = usersById.get(activity.actorId);
  const paciente = pacientesById.get(activity.pacienteId);
  const documentId =
    activity.subject === "historia"
      ? activity.historiaId ?? activity.pacienteId
      : activity.pacienteId;

  return {
    action: activity.action,
    actorEmail: actor?.email,
    actorId: activity.actorId,
    actorName: actor?.name ?? "Usuario no encontrado",
    changes: activity.changes ?? [],
    changedFields: activity.changedFields,
    createdAt: activity.createdAt,
    documentId,
    documentLabel:
      activity.subject === "historia" ? "Historia clinica" : "Paciente",
    id: activity._id ?? `${activity.actorId}-${activity.createdAt}`,
    pacienteLabel: pacienteLabel(paciente),
    stationLabel: stationLabel(activity.stationKey),
    subject: activity.subject,
    viajeId: activity.viajeId,
    viajeLabel: activity.viajeLabel,
  };
}

function diagnosisItems(historia: ExistingHistoria) {
  const diagnostico = historia.diagnostico;
  if (!diagnostico?.principal) {
    return [];
  }

  return [diagnostico.principal, ...(diagnostico.secundarios ?? [])];
}

function diagnosisLabel(diagnosis: DiagnosticoCie11) {
  return String(diagnosis.title || diagnosis.code || diagnosis.iNo || "").trim();
}

function mergeGenderRows(rows: DiagnosisSummaryRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const gender of row.genderRows) {
      totals.set(gender.genero, (totals.get(gender.genero) ?? 0) + gender.historias);
    }
  }

  return [...totals.entries()]
    .map(([genero, historias]) => ({ genero, historias }))
    .sort((a, b) => b.historias - a.historias);
}

function pacienteLabel(paciente?: ExistingPaciente) {
  if (!paciente) {
    return "Paciente no encontrado";
  }

  return [
    paciente.datosPersonales.nombres,
    paciente.datosPersonales.apellidoPaterno,
    paciente.datosPersonales.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(" ");
}

function stationLabel(stationKey: StationKey) {
  return stationConfigs[stationKey]?.viajeTipo ?? stationKey;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}

function isHistoria(doc: unknown): doc is ExistingHistoria {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia"
  );
}

function isPaciente(doc: unknown): doc is ExistingPaciente {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente"
  );
}

function isActividad(doc: unknown): doc is ExistingActividad {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "actividad"
  );
}
