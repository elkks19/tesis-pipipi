"use server";

import { db } from "@/lib/db";
import {
  docenteRoles,
  estudianteRoles,
  type AuthRole,
} from "@/lib/auth-role-values";
import { getAuthUsersByIds } from "@/lib/auth-users";
import { CreateViajeSchema, type Viaje } from "@/lib/schema/viajes";

type EditViajeActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
  viajeId?: string;
};

type ViajeDocument = Viaje & {
  _id: string;
  _rev: string;
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

function getTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

function canEditViaje(viaje: Viaje) {
  return viaje.fechaEntrada > getTodayValue();
}

function hasRole(role: AuthRole | null, roles: readonly AuthRole[]) {
  return role !== null && roles.includes(role);
}

function getEstaciones(formData: FormData) {
  const estaciones = [];

  for (let index = 0; formData.has(`estaciones.${index}.tipo`); index += 1) {
    estaciones.push({
      tipo: getString(formData, `estaciones.${index}.tipo`),
      docenteEncargado: getString(
        formData,
        `estaciones.${index}.docenteEncargado`,
      ),
      estudiantes: formData
        .getAll(`estaciones.${index}.estudiantes`)
        .filter((value): value is string => typeof value === "string"),
    });
  }

  return estaciones;
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

function isViajeDocument(doc: unknown): doc is ViajeDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viaje" &&
    "_id" in doc &&
    "_rev" in doc
  );
}

export async function updateViaje(
  viajeId: string,
  _previousState: EditViajeActionState,
  formData: FormData,
): Promise<EditViajeActionState> {
  void _previousState;

  const existing = await db.get(viajeId).catch(() => null);

  if (!isViajeDocument(existing)) {
    return {
      message: "No se encontro el viaje que quieres editar.",
      ok: false,
    };
  }

  if (!canEditViaje(existing)) {
    return {
      message: "Solo se pueden editar viajes que aun no iniciaron.",
      ok: false,
    };
  }

  const parsed = CreateViajeSchema.safeParse(getPayload(formData));

  if (!parsed.success) {
    return {
      errors: getFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de actualizar el viaje.",
      ok: false,
    };
  }

  const selectedUserIds = parsed.data.estaciones.flatMap((estacion) => [
    estacion.docenteEncargado,
    ...estacion.estudiantes,
  ]);
  const usersById = getAuthUsersByIds(selectedUserIds);
  const roleErrors: Record<string, string> = {};

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

  const viaje: ViajeDocument = {
    ...existing,
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
    await db.put(viaje);

    return {
      message: "Viaje actualizado correctamente.",
      ok: true,
      viajeId,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el viaje.",
      ok: false,
    };
  }
}
