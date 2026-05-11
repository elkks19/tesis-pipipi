"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import {
  CreateAnamnesisSchema,
  type Anamnesis,
} from "@/lib/schema/anamnesis";
import type { Historia } from "@/lib/schema/historia";
import type { Paciente } from "@/lib/schema/pacientes";

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
    menarca: requiredNumber(formData, "antecedentesGinecoObstetricos.menarca"),
    ritmoMenstrual: getString(
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
    fechaUltimaGestacion: getString(
      formData,
      "antecedentesGinecoObstetricos.fechaUltimaGestacion",
    ),
    fechaUltimoParto: getString(
      formData,
      "antecedentesGinecoObstetricos.fechaUltimoParto",
    ),
    fechaUltimoAborto: getString(
      formData,
      "antecedentesGinecoObstetricos.fechaUltimoAborto",
    ),
    fechaUltimaCesarea: getString(
      formData,
      "antecedentesGinecoObstetricos.fechaUltimaCesarea",
    ),
    edadMenopausia: requiredNumber(
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
    inicioVidaSexual: requiredNumber(
      formData,
      "antecedentesGinecoObstetricos.inicioVidaSexual",
    ),
    numeroParejasSexuales: requiredNumber(
      formData,
      "antecedentesGinecoObstetricos.numeroParejasSexuales",
    ),
    cirugiaPelviana: getString(
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
    anosCursados: optionalNumber(formData, "anosCursados"),
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
      errors: getFieldErrors(parsed.error),
      message: "Revisa los campos marcados antes de guardar la anamnesis.",
      ok: false,
    };
  }

  const { pacienteId, ...anamnesisData } = parsed.data;
  const viajeId = optionalString(formData, "viajeId");
  const historiaId = getDocumentId(pacienteId);
  const historia: Historia = {
    type: "historia",
    created_by: userId,
    pacienteId,
    ...(viajeId ? { viajeId } : {}),
    anamnesis: {
      ...(anamnesisData as Anamnesis),
      created_by: userId,
      updated_by: userId,
    },
  };

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

    await db.put({
      _id: historiaId,
      ...historia,
    });

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
