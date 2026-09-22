import { notFound, redirect } from "next/navigation";

import {
  updateAnamnesis,
} from "@/app/estudiante/anamnesis/create-historia/actions";
import {
  AnamnesisForm,
  type AnamnesisFormValue,
} from "@/components/forms/anamnesis-form";
import { HistoriaClinicalSummaryModal } from "@/components/historias/historia-clinical-summary-server";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import type { Historia } from "@/lib/schema/historia";
import type { Paciente } from "@/lib/schema/pacientes";
import { isDocenteEncargado } from "@/lib/station-histories";

type PageProps = {
  params: Promise<{
    idHistoria: string;
  }>;
};

type HistoriaDocument = PouchDB.Core.ExistingDocument<Historia>;

function isHistoria(doc: unknown): doc is HistoriaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "historia" &&
    "_id" in doc
  );
}

function isPaciente(doc: unknown): doc is Paciente {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente"
  );
}

function numberToFormValue(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

function dateToFormValue(value: Date | string | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toFormValue(historia: HistoriaDocument): Partial<AnamnesisFormValue> {
  const anamnesis = historia.anamnesis;

  if (!anamnesis) {
    return {
      pacienteId: historia.pacienteId,
    };
  }

  return {
    pacienteId: historia.pacienteId,
    estadoCivil: anamnesis.estadoCivil,
    nivelEducativo: anamnesis.nivelEducativo,
    añosCursados: numberToFormValue(anamnesis.añosCursados),
    situacionLaboral: anamnesis.situacionLaboral ?? "",
    motivoConsulta: anamnesis.motivoConsulta,
    historiaEnfermedadActual: anamnesis.historiaEnfermedadActual,
    antecedentesNoPatologicos: anamnesis.antecedentesNoPatologicos,
    antecedentesPatologicos: {
      personales: anamnesis.antecedentesPatologicos.personales.map((item) => ({
        enfermedad: item.enfermedad,
        fechaDiagnostico: dateToFormValue(item.fechaDiagnostico),
        tratamiento: item.tratamiento ?? "",
      })),
      familiares: anamnesis.antecedentesPatologicos.familiares.map((item) => ({
        parentesco: item.parentesco,
        enfermedad: item.enfermedad,
        edadDiagnostico: numberToFormValue(item.edadDiagnostico),
        fallecimiento: item.fallecimiento,
        edadFallecimiento: numberToFormValue(item.edadFallecimiento),
      })),
    },
    antecedentesGinecoObstetricos: anamnesis.antecedentesGinecoObstetricos
      ? {
          ...anamnesis.antecedentesGinecoObstetricos,
          estadioTanner: anamnesis.antecedentesGinecoObstetricos.estadioTanner ?? "",
          ritmoMenstrual: anamnesis.antecedentesGinecoObstetricos.ritmoMenstrual ?? "",
          cirugiaPelviana: anamnesis.antecedentesGinecoObstetricos.cirugiaPelviana ?? "",
          fechaUltimaGestacion: dateToFormValue(anamnesis.antecedentesGinecoObstetricos.fechaUltimaGestacion),
          fechaUltimoParto: dateToFormValue(anamnesis.antecedentesGinecoObstetricos.fechaUltimoParto),
          fechaUltimoAborto: dateToFormValue(anamnesis.antecedentesGinecoObstetricos.fechaUltimoAborto),
          fechaUltimaCesarea: dateToFormValue(anamnesis.antecedentesGinecoObstetricos.fechaUltimaCesarea),
          menarca: numberToFormValue(
            anamnesis.antecedentesGinecoObstetricos.menarca,
          ),
          gestaciones: numberToFormValue(
            anamnesis.antecedentesGinecoObstetricos.gestaciones,
          ),
          partos: numberToFormValue(
            anamnesis.antecedentesGinecoObstetricos.partos,
          ),
          abortos: numberToFormValue(
            anamnesis.antecedentesGinecoObstetricos.abortos,
          ),
          cesareas: numberToFormValue(
            anamnesis.antecedentesGinecoObstetricos.cesareas,
          ),
          edadMenopausia: numberToFormValue(
            anamnesis.antecedentesGinecoObstetricos.edadMenopausia,
          ),
          inicioVidaSexual: numberToFormValue(
            anamnesis.antecedentesGinecoObstetricos.inicioVidaSexual,
          ),
          numeroParejasSexuales: numberToFormValue(
            anamnesis.antecedentesGinecoObstetricos.numeroParejasSexuales,
          ),
          metodoAnticonceptivo:
            anamnesis.antecedentesGinecoObstetricos.metodoAnticonceptivo ?? "",
          fechaPapanicolau: dateToFormValue(anamnesis.antecedentesGinecoObstetricos.fechaPapanicolau),
          resultadoPapanicolau:
            anamnesis.antecedentesGinecoObstetricos.resultadoPapanicolau ?? "",
          colposcopia:
            anamnesis.antecedentesGinecoObstetricos.colposcopia ?? "",
          biopsiaCervical:
            anamnesis.antecedentesGinecoObstetricos.biopsiaCervical ?? "",
        }
      : undefined,
  };
}

export default async function DocenteEditarAnamnesisPage({
  params,
}: PageProps) {
  const { idHistoria } = await params;
  const decodedIdHistoria = decodeURIComponent(idHistoria);
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const doc = await db.get(decodedIdHistoria).catch(() => null);

  if (!isHistoria(doc)) {
    notFound();
  }

  const canEdit = await isDocenteEncargado({
    historia: doc,
    stationKey: "anamnesis",
    userId,
  });

  if (!canEdit) {
    notFound();
  }

  const paciente = await db.get(doc.pacienteId).catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Editar anamnesis
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Actualiza la anamnesis registrada para esta historia clinica.
        </p>
      </div>
      <HistoriaClinicalSummaryModal
        historia={doc}
        scope="diagnostico"
      />
      <AnamnesisForm
        action={updateAnamnesis.bind(null, decodedIdHistoria)}
        defaultValue={toFormValue(doc)}
        pacienteGenero={isPaciente(paciente) ? paciente.genero : undefined}
        pacienteFechaNacimiento={isPaciente(paciente) ? new Date(paciente.datosPersonales.fechaNacimiento).toISOString() : undefined}
        successRedirectHref="/docente/anamnesis"
      />
    </div>
  );
}
