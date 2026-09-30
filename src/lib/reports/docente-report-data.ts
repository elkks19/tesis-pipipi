import "server-only";

import { getAuthenticatedUser } from "@/lib/auth-session";
import { getAuthUsersByIds } from "@/lib/auth-users";
import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import { canAccessDocente, getSessionUserRole } from "@/lib/role-redirect";
import { resolveDocenteTripRoute } from "@/lib/student-trip-resolution";
import { stationConfigs, type StationKey } from "@/lib/station-histories";
import type { Historia, Receta } from "@/lib/schema";
import type { DocenteReportOptions } from "./docente-report-options";

export function belongsToReportStation(historia: Historia, stationKey: StationKey, viajeId: string) {
  if (historia.type !== "historia" || historia.viajeId !== viajeId) return false;
  const config = stationConfigs[stationKey];
  return !("complementaryKey" in config) || Boolean(historia.examenesComplementariosSolicitados?.[config.complementaryKey]);
}

async function allTripDocuments(type: string, viajeId: string) {
  const docs: Awaited<ReturnType<typeof findTesisDocs>>["docs"] = [];
  for (let skip = 0; ; skip += 200) {
    const page = await findTesisDocs({ selector: { type, viajeId }, limit: 200, skip });
    docs.push(...page.docs);
    if (page.docs.length < 200) return docs;
  }
}

/** Resolve assignment from the session before reading any clinical records. */
export async function getDocenteReportData(stationKey: StationKey, includePrescriptions = false) {
  const user = await getAuthenticatedUser();
  if (!user || !canAccessDocente(getSessionUserRole(user))) return null;
  const { activeTrip } = await resolveDocenteTripRoute(user.id);
  const config = stationConfigs[stationKey];
  if (!activeTrip || activeTrip.estacionTipo !== config.viajeTipo) return null;
  const trip = await db.get(activeTrip.viajeId);
  if (trip.type !== "viaje") return null;
  const assignment = trip.estaciones.find((station) => station.tipo === config.viajeTipo && station.docenteEncargadoId === user.id);
  if (!assignment) return null;
  await ensureTesisIndexes();
  const [historyDocs, prescriptionDocs, deliveryDocs] = await Promise.all([
    allTripDocuments("historia", activeTrip.viajeId),
    stationKey === "farmacia" || includePrescriptions ? allTripDocuments("receta", activeTrip.viajeId) : Promise.resolve([]),
    stationKey === "farmacia" || includePrescriptions ? allTripDocuments("dispensacionReceta", activeTrip.viajeId) : Promise.resolve([]),
  ]);
  const prescriptions = prescriptionDocs.filter((doc) => doc.type === "receta");
  const deliveries = deliveryDocs.filter((doc) => doc.type === "dispensacionReceta");
  const records = historyDocs.filter((doc) => doc.type === "historia")
    .filter((doc) => belongsToReportStation(doc, stationKey, activeTrip.viajeId))
    .map((historia) => {
      const receta: (Receta & { _id?: string }) | undefined = prescriptions.find((doc) => doc.historiaId === historia._id) ?? historia.receta;
      const stationValue = historia[config.field] as { created_by?: string } | undefined;
      const authorIds = stationKey === "farmacia"
        ? [...new Set(deliveries.filter((doc) => doc.recetaId === (receta?._id ?? receta?.id)).map((doc) => doc.createdBy).concat(receta?.entregadaBy ? [receta.entregadaBy] : []))]
        : stationValue?.created_by ? [stationValue.created_by] : [];
      return { historia, receta, deliveries: deliveries.filter((doc) => doc.recetaId === (receta?._id ?? receta?.id)), authorIds, completed: stationKey === "farmacia" ? Boolean(receta?.entregada) : Boolean(stationValue) };
    }).filter((record) => stationKey !== "farmacia" || Boolean(record.receta));
  const patientIds = [...new Set(records.map((record) => record.historia.pacienteId))];
  const patients = new Map<string, import("@/lib/schema").Paciente & { _id: string }>();
  for (let offset = 0; offset < patientIds.length; offset += 200) {
    const result = await db.allDocs({ keys: patientIds.slice(offset, offset + 200), include_docs: true });
    for (const row of result.rows) {
      if ("doc" in row && row.doc?.type === "paciente") patients.set(row.id, row.doc);
    }
  }
  const users = getAuthUsersByIds([...assignment.estudiantesIds, ...records.flatMap((record) => [
    ...record.authorIds, record.historia.created_by ?? record.historia.anamnesis?.created_by,
    ...Object.values(stationConfigs).flatMap((station) => {
      const section = record.historia[station.field] as { created_by?: string; updated_by?: string } | undefined;
      return [section?.created_by, section?.updated_by];
    }),
    record.receta?.createdBy, record.receta?.updatedBy, record.receta?.entregadaBy,
    ...record.deliveries.map((delivery) => delivery.createdBy),
  ]).filter((id): id is string => Boolean(id))]);
  const options: DocenteReportOptions = {
    stationKey, stationLabel: config.viajeTipo, tripLabel: activeTrip.servicio, establishment: activeTrip.establecimiento,
    students: assignment.estudiantesIds.map((id) => ({ id, name: users.get(id)?.name ?? "Estudiante sin nombre" })),
    visits: records.map(({ historia, authorIds, completed }) => {
      const patient = patients.get(historia.pacienteId);
      const personal = patient?.datosPersonales;
      return {
        id: historia._id, patientId: historia.pacienteId, name: personal ? [personal.nombres, personal.apellidoPaterno, personal.apellidoMaterno].filter(Boolean).join(" ") : "Paciente sin datos",
        document: personal ? `${personal.documentoIdentidad} ${personal.numeroDocumentoIdentidad}` : "Sin documento",
        date: historia.createdAt ?? "", authorIds, completed,
        author: authorIds.map((id) => users.get(id)?.name ?? "Usuario no encontrado").join(", ") || "Sin responsable registrado",
      };
    }).sort((a, b) => b.date.localeCompare(a.date)),
  };
  return { options, records, patients, users, generatedBy: user.name };
}

export type DocenteReportData = NonNullable<Awaited<ReturnType<typeof getDocenteReportData>>>;
