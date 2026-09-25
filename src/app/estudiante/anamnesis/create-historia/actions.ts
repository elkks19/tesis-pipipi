"use server";

import { revalidatePath } from "next/cache";

import { logStationActivity, resolveActiveViajeForUser } from "@/lib/activity-log";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import {
  CreateAnamnesisSchema,
  getAnamnesisSchemaForPatient,
  type Anamnesis,
} from "@/lib/schema/anamnesis";
import { firstFieldErrors } from "@/lib/schema/field-errors";
import type { Historia } from "@/lib/schema/historia";
import type { Paciente } from "@/lib/schema/pacientes";
import { canAccessActiveStationHistoria } from "@/lib/station-histories";

export type CreateAnamnesisActionState = {
  errors?: Record<string, string>;
  historiaId?: string;
  message?: string;
  ok: boolean;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function optionalString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

function optionalNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value.length > 0 ? Number(value) : undefined;
}

function requiredNumber(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value.length > 0 ? Number(value) : Number.NaN;
}

function getDisease(formData: FormData, key: string) {
  return {
    code: getString(formData, `${key}.code`),
    iNo: getString(formData, `${key}.iNo`),
    title: getString(formData, `${key}.title`),
  };
}

function getPersonales(formData: FormData) {
  const personales = [];

  for (
    let index = 0;
    formData.has(
      `antecedentesPatologicos.personales.${index}.enfermedad.code`,
    );
    index += 1
  ) {
    personales.push({
      enfermedad: getDisease(
        formData,
        `antecedentesPatologicos.personales.${index}.enfermedad`,
      ),
      fechaDiagnostico: optionalString(
        formData,
        `antecedentesPatologicos.personales.${index}.fechaDiagnostico`,
      ),
      tratamiento: optionalString(
        formData,
        `antecedentesPatologicos.personales.${index}.tratamiento`,
      ),
    });
  }

  return personales;
}

function getFamiliares(formData: FormData) {
  const familiares = [];

  for (
    let index = 0;
    formData.has(`antecedentesPatologicos.familiares.${index}.parentesco`);
    index += 1
  ) {
    familiares.push({
      parentesco: getString(
        formData,
        `antecedentesPatologicos.familiares.${index}.parentesco`,
      ),
      enfermedad: getDisease(
        formData,
        `antecedentesPatologicos.familiares.${index}.enfermedad`,
      ),
      edadDiagnostico: requiredNumber(
        formData,
        `antecedentesPatologicos.familiares.${index}.edadDiagnostico`,
      ),
      fallecimiento:
        formData.get(
          `antecedentesPatologicos.familiares.${index}.fallecimiento`,
        ) === "true",
      edadFallecimiento: optionalNumber(
        formData,
        `antecedentesPatologicos.familiares.${index}.edadFallecimiento`,
      ),
    });
  }

  return familiares;
}

function getGinecoObstetricos(formData: FormData) {
  if (!formData.has("antecedentesGinecoObstetricos.estadioTanner")) {
    return undefined;
  }

  return {
    estadioTanner: getString(
      formData,
      "antecedentesGinecoObstetricos.estadioTanner",
    ),
    menarca: optionalNumber(formData, "antecedentesGinecoObstetricos.menarca"),
    ritmoMenstrual: optionalString(
      formData,
      "antecedentesGinecoObstetricos.ritmoMenstrual",
    ),
    gestaciones: requiredNumber(
      formData,
      "antecedentesGinecoObstetricos.gestaciones",
    ),
    partos: requiredNumber(formData, "antecedentesGinecoObstetricos.partos"),
    abortos: requiredNumber(formData, "antecedentesGinecoObstetricos.abortos"),
    cesareas: requiredNumber(
      formData,
      "antecedentesGinecoObstetricos.cesareas",
    ),
    fechaUltimaGestacion: optionalString(
      formData,
      "antecedentesGinecoObstetricos.fechaUltimaGestacion",
    ),
    fechaUltimoParto: optionalString(
      formData,
      "antecedentesGinecoObstetricos.fechaUltimoParto",
    ),
    fechaUltimoAborto: optionalString(
      formData,
      "antecedentesGinecoObstetricos.fechaUltimoAborto",
    ),
    fechaUltimaCesarea: optionalString(
      formData,
      "antecedentesGinecoObstetricos.fechaUltimaCesarea",
    ),
    edadMenopausia: optionalNumber(
      formData,
      "antecedentesGinecoObstetricos.edadMenopausia",
    ),
    terapiaAnticonceptiva:
      formData.get(
        "antecedentesGinecoObstetricos.terapiaAnticonceptiva",
      ) === "true",
    metodoAnticonceptivo: optionalString(
      formData,
      "antecedentesGinecoObstetricos.metodoAnticonceptivo",
    ),
    inicioVidaSexual: optionalNumber(
      formData,
      "antecedentesGinecoObstetricos.inicioVidaSexual",
    ),
    numeroParejasSexuales: optionalNumber(
      formData,
      "antecedentesGinecoObstetricos.numeroParejasSexuales",
    ),
    cirugiaPelviana: optionalString(
      formData,
      "antecedentesGinecoObstetricos.cirugiaPelviana",
    ),
    fechaPapanicolau: optionalString(
      formData,
      "antecedentesGinecoObstetricos.fechaPapanicolau",
    ),
    resultadoPapanicolau: optionalString(
      formData,
      "antecedentesGinecoObstetricos.resultadoPapanicolau",
    ),
    colposcopia: optionalString(
      formData,
      "antecedentesGinecoObstetricos.colposcopia",
    ),
    biopsiaCervical: optionalString(
      formData,
      "antecedentesGinecoObstetricos.biopsiaCervical",
    ),
  };
}

function getPayload(formData: FormData) {
  return {
    pacienteId: getString(formData, "pacienteId"),
    estadoCivil: getString(formData, "estadoCivil"),
    nivelEducativo: getString(formData, "nivelEducativo"),
    añosCursados: optionalNumber(formData, "añosCursados"),
    situacionLaboral: optionalString(formData, "situacionLaboral"),
    motivoConsulta: getString(formData, "motivoConsulta"),
    historiaEnfermedadActual: getString(formData, "historiaEnfermedadActual"),
    antecedentesNoPatologicos: {
      habitoTabaquico: getString(
        formData,
        "antecedentesNoPatologicos.habitoTabaquico",
      ),
      consumoAlcohol: getString(
        formData,
        "antecedentesNoPatologicos.consumoAlcohol",
      ),
      realizaActividadFisica:
        formData.get("antecedentesNoPatologicos.realizaActividadFisica") ===
        "true",
      consumoFrutasVerduras: getString(
        formData,
        "antecedentesNoPatologicos.consumoFrutasVerduras",
      ),
    },
    antecedentesPatologicos: {
      personales: getPersonales(formData),
      familiares: getFamiliares(formData),
    },
    antecedentesGinecoObstetricos: getGinecoObstetricos(formData),
  };
}

function getDocumentId(pacienteId: string) {
  return `historia:${pacienteId}:${crypto.randomUUID()}`;
}

function isPaciente(doc: unknown): doc is Paciente {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente"
  );
}

function removeGinecoObstetricosForPaciente<
  T extends { antecedentesGinecoObstetricos?: unknown },
>(anamnesis: T, paciente: Paciente) {
  if (paciente.genero.trim().toLowerCase() === "femenino") {
    return anamnesis;
  }

  return {
    ...anamnesis,
    antecedentesGinecoObstetricos: undefined,
  };
}

export async function createAnamnesis(
  _previousState: CreateAnamnesisActionState,
  formData: FormData,
): Promise<CreateAnamnesisActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para guardar la anamnesis.",
      ok: false,
    };
  }

  const parsed = CreateAnamnesisSchema.safeParse(getPayload(formData));

  if (!parsed.success) {
    return {
      errors: firstFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar la anamnesis.",
      ok: false,
    };
  }

  const { pacienteId } = parsed.data;
  const activeTrip = await resolveActiveViajeForUser(userId);
  const viajeId = activeTrip?.viajeId ?? optionalString(formData, "viajeId");

  if (!viajeId) {
    return {
      message: "No tienes un viaje activo para crear historias.",
      ok: false,
    };
  }

  const historiaId = getDocumentId(pacienteId);
  try {
    const paciente = await db.get(pacienteId);

    if (!isPaciente(paciente)) {
      return {
        errors: {
          pacienteId: "El documento encontrado no corresponde a un paciente.",
        },
        message: "No se pudo crear la historia.",
        ok: false,
      };
    }

    const ageValidated = getAnamnesisSchemaForPatient(paciente.datosPersonales.fechaNacimiento).safeParse(getPayload(formData));
    if (!ageValidated.success) {
      return { errors: firstFieldErrors(ageValidated.error), message: "Revisa los campos marcados antes de guardar la anamnesis.", ok: false };
    }
    const { pacienteId: _validatedPacienteId, ...anamnesisData } = ageValidated.data;
    void _validatedPacienteId;

    const anamnesis = {
      ...(removeGinecoObstetricosForPaciente(
        anamnesisData,
        paciente,
      ) as Anamnesis),
      created_by: userId,
      updated_by: userId,
    };
    const createdAt = new Date().toISOString();
    const historia: Historia = {
      type: "historia",
      created_by: userId,
      createdAt,
      updatedAt: createdAt,
      pacienteId,
      viajeId,
      anamnesis,
    };

    await db.put({
      _id: historiaId,
      ...historia,
    });
    await logStationActivity({
      actorId: userId,
      after: anamnesis,
      before: undefined,
      historia: {
        _id: historiaId,
        ...historia,
      },
      stationKey: "anamnesis",
    }).catch(() => undefined);

    revalidatePath("/estudiante/anamnesis/create-historia");
    revalidatePath("/estudiante/anamnesis");

    return {
      historiaId,
      message: "Historia creada correctamente.",
      ok: true,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404
    ) {
      return {
        errors: {
          pacienteId: "No existe un paciente con este identificador.",
        },
        message: "Selecciona un paciente existente antes de crear la historia.",
        ok: false,
      };
    }

    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo guardar la historia en la base de datos.",
      ok: false,
    };
  }
}

function isHistoria(doc: unknown): doc is Historia & { _id: string; _rev: string } {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia" &&
    "_id" in doc &&
    "_rev" in doc
  );
}

export async function updateAnamnesis(
  idHistoria: string,
  _previousState: CreateAnamnesisActionState,
  formData: FormData,
): Promise<CreateAnamnesisActionState> {
  void _previousState;

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return {
      message: "Debes iniciar sesion para editar la anamnesis.",
      ok: false,
    };
  }

  const parsed = CreateAnamnesisSchema.safeParse(getPayload(formData));

  if (!parsed.success) {
    return {
      errors: firstFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar la anamnesis.",
      ok: false,
    };
  }

  try {
    const historia = await db.get(idHistoria);

    if (!isHistoria(historia)) {
      return {
        message: "No se encontro la historia clinica.",
        ok: false,
      };
    }

    const canEdit = await canAccessActiveStationHistoria({
      historia,
      stationKey: "anamnesis",
      userId,
    });

    if (!canEdit) {
      return {
        message: "No puedes editar una historia fuera de tu estacion.",
        ok: false,
      };
    }

    const { pacienteId } = parsed.data;

    if (pacienteId !== historia.pacienteId) {
      return {
        message: "La anamnesis no corresponde al paciente de esta historia.",
        ok: false,
      };
    }

    const paciente = await db.get(historia.pacienteId).catch(() => null);

    if (!isPaciente(paciente)) {
      return {
        message: "No se encontro el paciente de esta historia clinica.",
        ok: false,
      };
    }

    const ageValidated = getAnamnesisSchemaForPatient(paciente.datosPersonales.fechaNacimiento).safeParse(getPayload(formData));
    if (!ageValidated.success) {
      return { errors: firstFieldErrors(ageValidated.error), message: "Revisa los campos marcados antes de guardar la anamnesis.", ok: false };
    }
    const { pacienteId: _validatedPacienteId, ...anamnesisData } = ageValidated.data;
    void _validatedPacienteId;

    const before = historia.anamnesis;
    const anamnesis = {
      ...(removeGinecoObstetricosForPaciente(
        anamnesisData,
        paciente,
      ) as Anamnesis),
      created_by: before?.created_by ?? userId,
      updated_by: userId,
    };
    const nextHistoria = {
      ...historia,
      anamnesis,
      updatedAt: new Date().toISOString(),
    };

    await db.put(nextHistoria);
    await logStationActivity({
      actorId: userId,
      after: anamnesis,
      before,
      historia: nextHistoria,
      stationKey: "anamnesis",
    }).catch(() => undefined);

    revalidatePath("/docente/anamnesis");
    revalidatePath(`/docente/anamnesis/${idHistoria}`);

    return {
      historiaId: idHistoria,
      message: "Anamnesis actualizada correctamente.",
      ok: true,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la anamnesis.",
      ok: false,
    };
  }
}
