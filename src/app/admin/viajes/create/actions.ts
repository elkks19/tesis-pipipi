"use server";

import { headers } from "next/headers";

import { db } from "@/lib/db";
import { hasAuthPermission } from "@/lib/auth-permissions";
import {
  docenteRoles,
  estudianteRoles,
  type AuthRole,
} from "@/lib/auth-role-values";
import { getAuthUsersByIds } from "@/lib/auth-users";
import { CreateViajeSchema, type Viaje } from "@/lib/schema/viajes";

export type CreateViajeActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
  viajeId?: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function optionalString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();

  return value.length > 0 ? value : undefined;
}

function getFieldErrors(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray(error.issues)
  ) {
    return error.issues.reduce<Record<string, string>>((acc, issue) => {
      if (
        typeof issue === "object" &&
        issue !== null &&
        "path" in issue &&
        "message" in issue &&
        Array.isArray(issue.path)
      ) {
        acc[issue.path.join(".")] = String(issue.message);
      }

      return acc;
    }, {});
  }

  return {};
}

function dateToValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function hasRole(role: AuthRole | null, roles: readonly AuthRole[]) {
  return role !== null && roles.includes(role);
}

function getEstaciones(formData: FormData) {
  const stationIndexes = new Set<number>();

  for (const key of formData.keys()) {
    const match = key.match(/^estaciones\.(\d+)\./);

    if (match) {
      stationIndexes.add(Number(match[1]));
    }
  }

  return [...stationIndexes].sort((a, b) => a - b).map((index) => ({
      tipo: getString(formData, `estaciones.${index}.tipo`),
      docenteEncargado: getString(
        formData,
        `estaciones.${index}.docenteEncargado`,
      ),
      estudiantes: formData
        .getAll(`estaciones.${index}.estudiantes`)
        .filter((value): value is string => typeof value === "string"),
  }));
}

function getPayload(formData: FormData) {
  return {
    servicio: getString(formData, "servicio"),
    fechaEntrada: getString(formData, "fechaEntrada"),
    fechaSalida: getString(formData, "fechaSalida"),
    establecimiento: {
      nombre: getString(formData, "establecimiento.nombre"),
      direccion: optionalString(formData, "establecimiento.direccion"),
      contacto: optionalString(formData, "establecimiento.contacto"),
    },
    estaciones: getEstaciones(formData),
  };
}

function getDuplicateAssignmentErrors(
  estaciones: {
    docenteEncargado: string;
    estudiantes: string[];
  }[],
) {
  const errors: Record<string, string> = {};
  const assignedUsers = new Map<string, string>();

  estaciones.forEach((estacion, index) => {
    const stationLabel = `estacion ${index + 1}`;
    const assignments = [
      {
        field: `estaciones.${index}.docenteEncargado`,
        userId: estacion.docenteEncargado,
      },
      ...estacion.estudiantes.map((userId) => ({
        field: `estaciones.${index}.estudiantes`,
        userId,
      })),
    ].filter((assignment) => assignment.userId);

    const currentStationUsers = new Set<string>();

    assignments.forEach((assignment) => {
      if (currentStationUsers.has(assignment.userId)) {
        errors[assignment.field] =
          "Este usuario ya esta asignado en esta estacion.";
        return;
      }

      currentStationUsers.add(assignment.userId);
      const previousStation = assignedUsers.get(assignment.userId);

      if (previousStation) {
        errors[assignment.field] =
          `Este usuario ya fue asignado en ${previousStation}.`;
        return;
      }

      assignedUsers.set(assignment.userId, stationLabel);
    });
  });

  return errors;
}

export async function createViaje(
  _previousState: CreateViajeActionState,
  formData: FormData,
): Promise<CreateViajeActionState> {
  void _previousState;

  const canCreateViaje = await hasAuthPermission({
    headers: await headers(),
    permission: {
      viaje: ["create"],
    },
  });

  if (!canCreateViaje) {
    return {
      message: "No tienes permisos para crear viajes.",
      ok: false,
    };
  }

  const parsed = CreateViajeSchema.safeParse(getPayload(formData));

  if (!parsed.success) {
    return {
      errors: getFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar el viaje.",
      ok: false,
    };
  }

  const selectedUserIds = parsed.data.estaciones.flatMap((estacion) => [
    estacion.docenteEncargado,
    ...estacion.estudiantes,
  ]);
  const usersById = getAuthUsersByIds(selectedUserIds);
  const roleErrors = getDuplicateAssignmentErrors(parsed.data.estaciones);

  parsed.data.estaciones.forEach((estacion, index) => {
    const docente = usersById.get(estacion.docenteEncargado);

    if (!docente || !hasRole(docente.role, docenteRoles)) {
      roleErrors[`estaciones.${index}.docenteEncargado`] =
        "Selecciona un usuario con rol docente.";
    }

    const invalidStudent = estacion.estudiantes.some((studentId) => {
      const student = usersById.get(studentId);

      return !student || !hasRole(student.role, estudianteRoles);
    });

    if (invalidStudent) {
      roleErrors[`estaciones.${index}.estudiantes`] =
        "Selecciona solo usuarios con rol estudiante.";
    }
  });

  if (Object.keys(roleErrors).length > 0) {
    return {
      errors: roleErrors,
      message: "Revisa los roles de los usuarios asignados.",
      ok: false,
    };
  }

  const viajeId = `viaje:${crypto.randomUUID()}`;
  const viaje: Viaje = {
    id: viajeId,
    type: "viaje",
    servicio: parsed.data.servicio,
    fechaEntrada: dateToValue(parsed.data.fechaEntrada),
    fechaSalida: dateToValue(parsed.data.fechaSalida),
    establecimiento: parsed.data.establecimiento,
    estaciones: parsed.data.estaciones.map((estacion) => ({
      tipo: estacion.tipo,
      docenteEncargadoId: estacion.docenteEncargado,
      estudiantesIds: estacion.estudiantes,
    })),
  };

  try {
    await db.put({
      _id: viajeId,
      ...viaje,
    });

    return {
      message: "Viaje creado correctamente.",
      ok: true,
      viajeId,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el viaje.",
      ok: false,
    };
  }
}
