"use server";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { logPacienteActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { CreatePacienteSchema, type Paciente } from "@/lib/schema/pacientes";
import { firstFieldErrors } from "@/lib/schema/field-errors";

export type CreatePacienteActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();

  return value.length > 0 ? value : undefined;
}

function getPadres(formData: FormData) {
  const padres = [];

  for (let index = 0; formData.has(`padres.${index}.relacion`); index += 1) {
    padres.push({
      datosPersonales: {
        nombres: getString(formData, `padres.${index}.datosPersonales.nombres`),
        apellidoPaterno: getString(
          formData,
          `padres.${index}.datosPersonales.apellidoPaterno`,
        ),
        apellidoMaterno: getString(
          formData,
          `padres.${index}.datosPersonales.apellidoMaterno`,
        ),
        fechaNacimiento: getString(
          formData,
          `padres.${index}.datosPersonales.fechaNacimiento`,
        ),
        documentoIdentidad: getString(
          formData,
          `padres.${index}.datosPersonales.documentoIdentidad`,
        ),
        numeroDocumentoIdentidad: getString(
          formData,
          `padres.${index}.datosPersonales.numeroDocumentoIdentidad`,
        ),
      },
      relacion: getString(formData, `padres.${index}.relacion`),
      asumeSustento: formData.get(`padres.${index}.asumeSustento`) === "true",
      numeroContacto: getString(formData, `padres.${index}.numeroContacto`),
    });
  }

  return padres.length > 0 ? padres : undefined;
}

function getPacientePayload(formData: FormData) {
  return {
    datosPersonales: {
      nombres: getString(formData, "datosPersonales.nombres"),
      apellidoPaterno: getString(formData, "datosPersonales.apellidoPaterno"),
      apellidoMaterno: getString(formData, "datosPersonales.apellidoMaterno"),
      fechaNacimiento: getString(formData, "datosPersonales.fechaNacimiento"),
      documentoIdentidad: getString(
        formData,
        "datosPersonales.documentoIdentidad",
      ),
      numeroDocumentoIdentidad: getString(
        formData,
        "datosPersonales.numeroDocumentoIdentidad",
      ),
    },
    genero: getString(formData, "genero"),
    lugarNacimiento: {
      pais: getString(formData, "lugarNacimiento.pais"),
      departamento: getString(formData, "lugarNacimiento.departamento"),
      distrito: getOptionalString(formData, "lugarNacimiento.distrito"),
    },
    nacionalidad: getString(formData, "nacionalidad"),
    etnia: getOptionalString(formData, "etnia"),
    padres: getPadres(formData),
  };
}

function getDocumentId(paciente: Paciente) {
  const documento = paciente.datosPersonales.numeroDocumentoIdentidad.trim();
  const tipoDocumento = paciente.datosPersonales.documentoIdentidad
    .trim()
    .toLowerCase();

  if (documento.length > 0) {
    return `paciente:${tipoDocumento}:${documento}`;
  }

  return `paciente:${crypto.randomUUID()}`;
}

function isPaciente(doc: unknown): doc is PouchDB.Core.ExistingDocument<Paciente> {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente" &&
    "_id" in doc &&
    "_rev" in doc
  );
}

async function hasDuplicateDocument({
  currentPacienteId,
  paciente,
}: {
  currentPacienteId: string;
  paciente: Paciente;
}) {
  const expectedId = getDocumentId(paciente);

  if (expectedId === currentPacienteId) {
    return false;
  }

  try {
    const existing = await db.get(expectedId);

    return isPaciente(existing);
  } catch {
    return false;
  }
}

export async function createPaciente(
  _prevState: CreatePacienteActionState,
  formData: FormData,
): Promise<CreatePacienteActionState> {
  void _prevState;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para guardar el paciente.",
      ok: false,
    };
  }

  const parsed = CreatePacienteSchema.safeParse(getPacientePayload(formData));

  if (!parsed.success) {
    return {
      errors: firstFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar el paciente.",
      ok: false,
    };
  }

  const createdAt = new Date().toISOString();
  const paciente: Paciente = {
    type: "paciente",
    createdAt,
    updatedAt: createdAt,
    ...parsed.data,
  };

  try {
    const pacienteId = getDocumentId(paciente);

    await db.put({
      _id: pacienteId,
      ...paciente,
    });
    await logPacienteActivity({
      actorId: userId,
      after: paciente,
      pacienteId,
    }).catch(() => undefined);

    return {
      message: "Paciente creado correctamente.",
      ok: true,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 409
    ) {
      return {
        errors: {
          "datosPersonales.numeroDocumentoIdentidad":
            "Ya existe un paciente con este documento.",
        },
        message: "No se pudo crear el paciente.",
        ok: false,
      };
    }

    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el paciente en la base local.",
      ok: false,
    };
  }
}

export async function updatePaciente(
  pacienteId: string,
  _prevState: CreatePacienteActionState,
  formData: FormData,
): Promise<CreatePacienteActionState> {
  void _prevState;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para editar el paciente.",
      ok: false,
    };
  }

  const parsed = CreatePacienteSchema.safeParse(getPacientePayload(formData));

  if (!parsed.success) {
    return {
      errors: firstFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar el paciente.",
      ok: false,
    };
  }

  const paciente: Paciente = {
    type: "paciente",
    ...parsed.data,
  };

  try {
    const current = await db.get(pacienteId);

    if (!isPaciente(current)) {
      return {
        message: "No se encontro el paciente seleccionado.",
        ok: false,
      };
    }

    if (await hasDuplicateDocument({ currentPacienteId: pacienteId, paciente })) {
      return {
        errors: {
          "datosPersonales.numeroDocumentoIdentidad":
            "Ya existe otro paciente con este documento.",
        },
        message: "No se pudo actualizar el paciente.",
        ok: false,
      };
    }

    const updatedAt = new Date().toISOString();
    const nextPaciente: Paciente = {
      ...paciente,
      createdAt: current.createdAt,
      updatedAt,
    };

    await db.put({
      _id: current._id,
      _rev: current._rev,
      ...nextPaciente,
    });
    await logPacienteActivity({
      actorId: userId,
      after: nextPaciente,
      before: current,
      pacienteId: current._id,
    }).catch(() => undefined);

    return {
      message: "Paciente actualizado correctamente.",
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el paciente.",
      ok: false,
    };
  }
}
