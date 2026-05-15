import "server-only";

import { getAuthUsersByIds, type AuthUserListItem } from "@/lib/auth-users";
import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { Actividad, Historia, Paciente } from "@/lib/schema";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

import { getViajeByDocId } from "@/app/admin/viajes/queries";

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;

type PacienteDocument = PouchDB.Core.ExistingDocument<Paciente>;

type ActividadDocument = PouchDB.Core.ExistingDocument<Actividad>;

export type ViajeReportData = Awaited<ReturnType<typeof buildViajeReportData>>;

function isHistoria(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia"
  );
}

function isPaciente(doc: unknown): doc is PacienteDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente"
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

function fullName(paciente: PacienteDocument | undefined) {
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

function documentLabel(paciente: PacienteDocument | undefined) {
  if (!paciente) {
    return "Sin documento";
  }

  return `${paciente.datosPersonales.documentoIdentidad} ${paciente.datosPersonales.numeroDocumentoIdentidad}`;
}

function getAge(value: Date | string | undefined) {
  if (!value) {
    return null;
  }

  const birthDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPending =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate());

  if (birthdayPending) {
    age -= 1;
  }

  return age;
}

function userLabel(user: AuthUserListItem | undefined, fallbackId?: string) {
  return {
    email: user?.email ?? "",
    id: user?.id ?? fallbackId ?? "",
    nombre: user?.name ?? fallbackId ?? "Sin usuario",
  };
}

function stationFieldKeys() {
  return Object.entries(stationConfigs).map(([key, config]) => ({
    field: config.field,
    key: key as StationKey,
    label: config.viajeTipo,
  }));
}

function getCompletedStations(historia: HistoriaDocument) {
  return stationFieldKeys()
    .filter((station) => Boolean(historia[station.field]))
    .map((station) => station.label);
}

function getStationProduction(histories: HistoriaDocument[], stationKey: StationKey) {
  const config = stationConfigs[stationKey];
  const completadas = histories.filter((historia) => Boolean(historia[config.field])).length;
  const solicitadas =
    "complementaryKey" in config
      ? histories.filter((historia) =>
          Boolean(
            historia.examenesComplementariosSolicitados?.[config.complementaryKey],
          ),
        ).length
      : histories.length;

  return {
    completadas,
    pendientes: Math.max(0, solicitadas - completadas),
    solicitadas,
  };
}

function getActorIds(histories: HistoriaDocument[], activities: ActividadDocument[]) {
  return [
    ...histories.flatMap((historia) => [
      historia.created_by,
      historia.anamnesis?.created_by,
      historia.anamnesis?.updated_by,
      historia.examenFisicoGeneral?.created_by,
      historia.examenFisicoGeneral?.updated_by,
      historia.examenFisicoSegmentario?.created_by,
      historia.examenFisicoSegmentario?.updated_by,
      historia.ecografia?.created_by,
      historia.ecografia?.updated_by,
      historia.electrocardiograma?.created_by,
      historia.electrocardiograma?.updated_by,
      historia.espirometria?.created_by,
      historia.espirometria?.updated_by,
      historia.laboratorios?.created_by,
      historia.laboratorios?.updated_by,
      historia.diagnostico?.created_by,
      historia.diagnostico?.updated_by,
    ]),
    ...activities.map((activity) => activity.actorId),
  ].filter((id): id is string => Boolean(id));
}

export async function buildViajeReportData(viajeId: string) {
  await ensureTesisIndexes();

  const viaje = await getViajeByDocId(viajeId);

  if (!viaje) {
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
        type: "actividad",
        viajeId: viaje.docId,
      },
    }),
  ]);
  const histories = historiesResult.docs.filter(isHistoria);
  const activities = activitiesResult.docs
    .filter(isActividad)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const patientIds = [...new Set(histories.map((historia) => historia.pacienteId))];
  const patientDocs = await Promise.all(
    patientIds.map(async (pacienteId) => {
      try {
        const paciente = await db.get(pacienteId);

        return isPaciente(paciente) ? paciente : null;
      } catch {
        return null;
      }
    }),
  );
  const patientsById = new Map(
    patientDocs
      .filter((paciente): paciente is PacienteDocument => Boolean(paciente))
      .map((paciente) => [paciente._id, paciente] as const),
  );
  const viajeUserIds = viaje.estaciones.flatMap((estacion) => [
    estacion.docenteEncargadoId,
    ...estacion.estudiantesIds,
  ]);
  const usersById = getAuthUsersByIds([
    ...viajeUserIds,
    ...getActorIds(histories, activities),
  ]);
  const pacientes = histories.map((historia) => patientsById.get(historia.pacienteId));
  const uniquePatientIds = new Set(histories.map((historia) => historia.pacienteId));
  const completedByStation = stationFieldKeys().map((station) => ({
    ...station,
    ...getStationProduction(histories, station.key),
  }));

  return {
    generadoEn: new Date().toISOString(),
    viaje: {
      docId: viaje.docId,
      establecimiento: viaje.establecimiento,
      fechaEntrada: viaje.fechaEntrada,
      fechaSalida: viaje.fechaSalida,
      id: viaje.id,
      servicio: viaje.servicio,
    },
    resumen: {
      actividades: activities.length,
      diagnosticos: histories.filter((historia) => Boolean(historia.diagnostico)).length,
      docentes: viaje.resumenEquipo.docentesAsignados,
      electrocardiogramas: histories.filter((historia) =>
        Boolean(historia.electrocardiograma),
      ).length,
      ecografias: histories.filter((historia) => Boolean(historia.ecografia)).length,
      espirometrias: histories.filter((historia) => Boolean(historia.espirometria))
        .length,
      estaciones: viaje.estaciones.length,
      estudiantes: viaje.resumenEquipo.estudiantesAsignados,
      historias: histories.length,
      historiasCompletas: histories.filter((historia) => Boolean(historia.diagnostico))
        .length,
      laboratorios: histories.filter((historia) => Boolean(historia.laboratorios))
        .length,
      pacientes: uniquePatientIds.size,
    },
    estaciones: viaje.estaciones.map((estacion) => ({
      docenteEncargado: userLabel(
        estacion.docenteEncargado,
        estacion.docenteEncargadoId,
      ),
      estudiantes: [
        ...estacion.estudiantes.map((student) => userLabel(student, student.id)),
        ...estacion.estudiantesNoEncontrados.map((studentId) =>
          userLabel(undefined, studentId),
        ),
      ],
      produccion:
        completedByStation.find((station) => station.label === estacion.tipo) ?? null,
      tipo: estacion.tipo,
    })),
    pacientes: [...new Set(pacientes.filter(Boolean))].map((paciente) => ({
      documento: documentLabel(paciente),
      edad: getAge(paciente?.datosPersonales.fechaNacimiento),
      genero: paciente?.genero ?? "",
      id: paciente?._id ?? "",
      lugarNacimiento: [
        paciente?.lugarNacimiento.pais,
        paciente?.lugarNacimiento.departamento,
        paciente?.lugarNacimiento.distrito,
      ]
        .filter(Boolean)
        .join(" - "),
      nombreCompleto: fullName(paciente),
    })),
    historias: histories.map((historia) => {
      const paciente = patientsById.get(historia.pacienteId);

      return {
        diagnosticoPrincipal: historia.diagnostico?.principal.title ?? "",
        estacionesCompletadas: getCompletedStations(historia),
        examenesComplementariosSolicitados:
          historia.examenesComplementariosSolicitados ?? {
            ecografia: false,
            electrocardiograma: false,
            espirometria: false,
            laboratorios: false,
          },
        historiaId: historia._id ?? "",
        motivoConsulta: historia.anamnesis?.motivoConsulta ?? "",
        paciente: {
          documento: documentLabel(paciente),
          edad: getAge(paciente?.datosPersonales.fechaNacimiento),
          genero: paciente?.genero ?? "",
          id: historia.pacienteId,
          nombreCompleto: fullName(paciente),
        },
        planTrabajo: historia.diagnostico?.planTrabajo ?? "",
      };
    }),
    actividades: activities.map((activity) => {
      const paciente = patientsById.get(activity.pacienteId);
      const actor = usersById.get(activity.actorId);

      return {
        accion: activity.action,
        actor: userLabel(actor, activity.actorId),
        cambios: activity.changedFields,
        estacion: activity.stationKey,
        fecha: activity.createdAt,
        historiaId: activity.historiaId ?? "",
        paciente: {
          documento: documentLabel(paciente),
          id: activity.pacienteId,
          nombreCompleto: fullName(paciente),
        },
        sujeto: activity.subject,
      };
    }),
  };
}
