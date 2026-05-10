"use server";

import { db } from "@/lib/db";
import { CreatePacienteSchema, type Paciente } from "@/lib/schema/pacientes";

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

export async function createPaciente(
  _prevState: CreatePacienteActionState,
  formData: FormData,
): Promise<CreatePacienteActionState> {
  void _prevState;

  const parsed = CreatePacienteSchema.safeParse(getPacientePayload(formData));

  if (!parsed.success) {
    return {
      errors: getFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar el paciente.",
      ok: false,
    };
  }

  const paciente: Paciente = {
    type: "paciente",
    ...parsed.data,
  };

  try {
    await db.put({
      _id: getDocumentId(paciente),
      ...paciente,
    });

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
