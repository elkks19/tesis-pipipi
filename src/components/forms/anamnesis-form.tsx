"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useActionState,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";

import {
  DateField,
  IcdCodePicker,
  type IcdCodeValue,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  booleanSummary,
  textSummary,
  useSubmitConfirmation,
} from "@/components/forms/submit-confirmation";
import {
  consumosAlcohol,
  CreateAnamnesisSchema,
  estadosCiviles,
  getAnamnesisSchemaForPatient,
  habitosTabaco,
  nivelesEducativos,
  porcionesFrutasVerduras,
} from "@/lib/schema/anamnesis";
import { firstFieldErrors } from "@/lib/schema/field-errors";

type Emptyable<T extends string> = T | "";

type EnfermedadForm = IcdCodeValue;

type AntecedentePersonalForm = {
  enfermedad: EnfermedadForm;
  fechaDiagnostico: string;
  tratamiento: string;
};

type AntecedenteFamiliarForm = {
  parentesco: string;
  enfermedad: EnfermedadForm;
  edadDiagnostico: string;
  fallecimiento: boolean;
  edadFallecimiento: string;
};

type GinecoObstetricosForm = {
  estadioTanner: string;
  menarca: string;
  ritmoMenstrual: string;
  gestaciones: string;
  partos: string;
  abortos: string;
  cesareas: string;
  fechaUltimaGestacion: string;
  fechaUltimoParto: string;
  fechaUltimoAborto: string;
  fechaUltimaCesarea: string;
  edadMenopausia: string;
  terapiaAnticonceptiva: boolean;
  metodoAnticonceptivo: string;
  inicioVidaSexual: string;
  numeroParejasSexuales: string;
  cirugiaPelviana: string;
  fechaPapanicolau: string;
  resultadoPapanicolau: string;
  colposcopia: string;
  biopsiaCervical: string;
};

export type AnamnesisFormValue = {
  pacienteId: string;
  estadoCivil: Emptyable<(typeof estadosCiviles)[number]>;
  nivelEducativo: Emptyable<(typeof nivelesEducativos)[number]>;
  añosCursados: string;
  situacionLaboral: string;
  motivoConsulta: string;
  historiaEnfermedadActual: string;
  antecedentesNoPatologicos: {
    habitoTabaquico: Emptyable<(typeof habitosTabaco)[number]>;
    consumoAlcohol: Emptyable<(typeof consumosAlcohol)[number]>;
    realizaActividadFisica: boolean;
    consumoFrutasVerduras: Emptyable<(typeof porcionesFrutasVerduras)[number]>;
  };
  antecedentesPatologicos: {
    personales: AntecedentePersonalForm[];
    familiares: AntecedenteFamiliarForm[];
  };
  antecedentesGinecoObstetricos?: GinecoObstetricosForm;
};

type AnamnesisFormActionState = {
  errors?: Record<string, string>;
  historiaId?: string;
  message?: string;
  ok: boolean;
};

type AnamnesisFormAction = (
  previousState: AnamnesisFormActionState,
  formData: FormData,
) => Promise<AnamnesisFormActionState>;

type AnamnesisFormProps = {
  action?: AnamnesisFormAction;
  defaultValue?: Partial<AnamnesisFormValue>;
  pacienteGenero?: string;
  pacienteFechaNacimiento?: string;
  successRedirectHref?: string;
};

const emptyEnfermedad: EnfermedadForm = {
  code: "",
  iNo: "",
  title: "",
};

const emptyGineco: GinecoObstetricosForm = {
  estadioTanner: "",
  menarca: "",
  ritmoMenstrual: "",
  gestaciones: "",
  partos: "",
  abortos: "",
  cesareas: "",
  fechaUltimaGestacion: "",
  fechaUltimoParto: "",
  fechaUltimoAborto: "",
  fechaUltimaCesarea: "",
  edadMenopausia: "",
  terapiaAnticonceptiva: false,
  metodoAnticonceptivo: "",
  inicioVidaSexual: "",
  numeroParejasSexuales: "",
  cirugiaPelviana: "",
  fechaPapanicolau: "",
  resultadoPapanicolau: "",
  colposcopia: "",
  biopsiaCervical: "",
};

const baseFormValue: AnamnesisFormValue = {
  pacienteId: "",
  estadoCivil: "",
  nivelEducativo: "",
  añosCursados: "",
  situacionLaboral: "",
  motivoConsulta: "",
  historiaEnfermedadActual: "",
  antecedentesNoPatologicos: {
    habitoTabaquico: "",
    consumoAlcohol: "",
    realizaActividadFisica: false,
    consumoFrutasVerduras: "",
  },
  antecedentesPatologicos: {
    personales: [],
    familiares: [],
  },
};

function createPersonal(): AntecedentePersonalForm {
  return {
    enfermedad: { ...emptyEnfermedad },
    fechaDiagnostico: "",
    tratamiento: "",
  };
}

function createFamiliar(): AntecedenteFamiliarForm {
  return {
    parentesco: "",
    enfermedad: { ...emptyEnfermedad },
    edadDiagnostico: "",
    fallecimiento: false,
    edadFallecimiento: "",
  };
}

async function noopAction(): Promise<AnamnesisFormActionState> {
  return { ok: false };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalNumber(value: string) {
  return value.trim().length > 0 ? Number(value) : undefined;
}

function requiredNumber(value: string) {
  return value.trim().length > 0 ? Number(value) : Number.NaN;
}

function buildPayload(
  state: AnamnesisFormValue,
  options?: { includeGinecoObstetricos?: boolean },
) {
  const includeGinecoObstetricos = options?.includeGinecoObstetricos ?? true;

  return {
    pacienteId: state.pacienteId.trim(),
    estadoCivil: state.estadoCivil,
    nivelEducativo: state.nivelEducativo,
    añosCursados: optionalNumber(state.añosCursados),
    situacionLaboral: optionalText(state.situacionLaboral),
    motivoConsulta: state.motivoConsulta.trim(),
    historiaEnfermedadActual: state.historiaEnfermedadActual.trim(),
    antecedentesNoPatologicos: state.antecedentesNoPatologicos,
    antecedentesPatologicos: {
      personales: state.antecedentesPatologicos.personales.map((item) => ({
        enfermedad: item.enfermedad,
        fechaDiagnostico: optionalText(item.fechaDiagnostico),
        tratamiento: optionalText(item.tratamiento),
      })),
      familiares: state.antecedentesPatologicos.familiares.map((item) => ({
        parentesco: item.parentesco.trim(),
        enfermedad: item.enfermedad,
        edadDiagnostico: requiredNumber(item.edadDiagnostico),
        fallecimiento: item.fallecimiento,
        edadFallecimiento: optionalNumber(item.edadFallecimiento),
      })),
    },
    antecedentesGinecoObstetricos:
      includeGinecoObstetricos && state.antecedentesGinecoObstetricos
      ? {
          ...state.antecedentesGinecoObstetricos,
          menarca: optionalNumber(state.antecedentesGinecoObstetricos.menarca),
          gestaciones: requiredNumber(
            state.antecedentesGinecoObstetricos.gestaciones,
          ),
          partos: requiredNumber(state.antecedentesGinecoObstetricos.partos),
          abortos: requiredNumber(state.antecedentesGinecoObstetricos.abortos),
          cesareas: requiredNumber(state.antecedentesGinecoObstetricos.cesareas),
          edadMenopausia: optionalNumber(
            state.antecedentesGinecoObstetricos.edadMenopausia,
          ),
          inicioVidaSexual: optionalNumber(
            state.antecedentesGinecoObstetricos.inicioVidaSexual,
          ),
          numeroParejasSexuales: optionalNumber(
            state.antecedentesGinecoObstetricos.numeroParejasSexuales,
          ),
          metodoAnticonceptivo: optionalText(
            state.antecedentesGinecoObstetricos.metodoAnticonceptivo,
          ),
          fechaPapanicolau: optionalText(
            state.antecedentesGinecoObstetricos.fechaPapanicolau,
          ),
          resultadoPapanicolau: optionalText(
            state.antecedentesGinecoObstetricos.resultadoPapanicolau,
          ),
          colposcopia: optionalText(
            state.antecedentesGinecoObstetricos.colposcopia,
          ),
          biopsiaCervical: optionalText(
            state.antecedentesGinecoObstetricos.biopsiaCervical,
          ),
          ritmoMenstrual: optionalText(state.antecedentesGinecoObstetricos.ritmoMenstrual),
          cirugiaPelviana: optionalText(state.antecedentesGinecoObstetricos.cirugiaPelviana),
          fechaUltimaGestacion: optionalText(state.antecedentesGinecoObstetricos.fechaUltimaGestacion),
          fechaUltimoParto: optionalText(state.antecedentesGinecoObstetricos.fechaUltimoParto),
          fechaUltimoAborto: optionalText(state.antecedentesGinecoObstetricos.fechaUltimoAborto),
          fechaUltimaCesarea: optionalText(state.antecedentesGinecoObstetricos.fechaUltimaCesarea),
        }
      : undefined,
  };
}

function createInitialValue(defaultValue?: Partial<AnamnesisFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
    antecedentesNoPatologicos: {
      ...baseFormValue.antecedentesNoPatologicos,
      ...defaultValue?.antecedentesNoPatologicos,
    },
    antecedentesPatologicos: {
      personales: defaultValue?.antecedentesPatologicos?.personales ?? [],
      familiares: defaultValue?.antecedentesPatologicos?.familiares ?? [],
    },
    antecedentesGinecoObstetricos:
      defaultValue?.antecedentesGinecoObstetricos,
  };
}

function supportsGinecoObstetricos(genero: string | undefined) {
  return genero?.trim().toLowerCase() === "femenino";
}

function diseaseSummary(enfermedad: EnfermedadForm) {
  return [enfermedad.title, enfermedad.code].filter(Boolean).join(" · ") || "Sin registrar";
}

function getConfirmationSections(form: AnamnesisFormValue, includeGineco: boolean) {
  const gineco = includeGineco ? form.antecedentesGinecoObstetricos : undefined;
  const ginecoLabels: Record<keyof GinecoObstetricosForm, string> = {
    estadioTanner: "Estadio Tanner",
    menarca: "Menarca (años)",
    ritmoMenstrual: "Ritmo menstrual",
    gestaciones: "Gestaciones",
    partos: "Partos",
    abortos: "Abortos",
    cesareas: "Cesáreas",
    fechaUltimaGestacion: "Fecha de última gestación",
    fechaUltimoParto: "Fecha de último parto",
    fechaUltimoAborto: "Fecha de último aborto",
    fechaUltimaCesarea: "Fecha de última cesárea",
    edadMenopausia: "Edad de menopausia (años)",
    terapiaAnticonceptiva: "Terapia anticonceptiva",
    metodoAnticonceptivo: "Método anticonceptivo",
    inicioVidaSexual: "Inicio de vida sexual (años)",
    numeroParejasSexuales: "Número de parejas sexuales",
    cirugiaPelviana: "Cirugía pelviana",
    fechaPapanicolau: "Fecha de Papanicolau",
    resultadoPapanicolau: "Resultado de Papanicolau",
    colposcopia: "Colposcopia",
    biopsiaCervical: "Biopsia cervical",
  };
  return [
    {
      title: "Contexto",
      items: [
        { label: "Estado civil", value: textSummary(form.estadoCivil) },
        { label: "Nivel educativo", value: textSummary(form.nivelEducativo) },
        { label: "Años cursados", value: textSummary(form.añosCursados) },
        { label: "Situacion laboral", value: textSummary(form.situacionLaboral) },
      ],
    },
    {
      title: "Consulta",
      items: [
        { label: "Motivo de consulta", value: textSummary(form.motivoConsulta) },
        {
          label: "Historia de enfermedad actual",
          value: textSummary(form.historiaEnfermedadActual),
        },
      ],
    },
    {
      title: "Hábitos y estilo de vida",
      items: [
        { label: "Hábito tabáquico", value: textSummary(form.antecedentesNoPatologicos.habitoTabaquico) },
        { label: "Consumo de alcohol", value: textSummary(form.antecedentesNoPatologicos.consumoAlcohol) },
        { label: "Consumo de frutas y verduras", value: textSummary(form.antecedentesNoPatologicos.consumoFrutasVerduras) },
        {
          label: "Actividad física",
          value: booleanSummary(
            form.antecedentesNoPatologicos.realizaActividadFisica,
          ),
        },
      ],
    },
    ...(form.antecedentesPatologicos.personales.length > 0
      ? form.antecedentesPatologicos.personales.map((item, index) => ({
          title: `Antecedente personal ${index + 1}`,
          items: [
            { label: "Enfermedad · CIE-11", value: diseaseSummary(item.enfermedad) },
            { label: "Fecha de diagnóstico", value: textSummary(item.fechaDiagnostico) },
            { label: "Tratamiento", value: textSummary(item.tratamiento) },
          ],
        }))
      : [{ title: "Antecedentes personales", items: [{ label: "Registros", value: "Sin antecedentes registrados" }] }]),
    ...(form.antecedentesPatologicos.familiares.length > 0
      ? form.antecedentesPatologicos.familiares.map((item, index) => ({
          title: `Antecedente familiar ${index + 1}`,
          items: [
            { label: "Parentesco", value: textSummary(item.parentesco) },
            { label: "Enfermedad · CIE-11", value: diseaseSummary(item.enfermedad) },
            { label: "Edad de diagnóstico (años)", value: textSummary(item.edadDiagnostico) },
            { label: "Fallecimiento", value: booleanSummary(item.fallecimiento) },
            ...(item.fallecimiento ? [{ label: "Edad de fallecimiento (años)", value: textSummary(item.edadFallecimiento) }] : []),
          ],
        }))
      : [{ title: "Antecedentes familiares", items: [{ label: "Registros", value: "Sin antecedentes registrados" }] }]),
    ...(gineco ? [{
      title: "Antecedentes gineco-obstétricos",
      items: (Object.keys(ginecoLabels) as (keyof GinecoObstetricosForm)[]).map((key) => ({
        label: ginecoLabels[key],
        value: typeof gineco[key] === "boolean" ? booleanSummary(gineco[key]) : textSummary(gineco[key]),
      })),
    }] : []),
  ];
}

export function AnamnesisForm({
  action,
  defaultValue,
  pacienteGenero,
  pacienteFechaNacimiento,
  successRedirectHref,
}: AnamnesisFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<AnamnesisFormValue>(initialValue);
  const [activeStep, setActiveStep] = useState(0);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submission, setSubmission] = useState<{ form: AnamnesisFormValue; actionState: AnamnesisFormActionState } | null>(null);
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: "Guardar anamnesis",
    });
  const showGinecoObstetricos = supportsGinecoObstetricos(pacienteGenero);
  const validation = useMemo(() => {
    const payload = buildPayload(form, { includeGinecoObstetricos: showGinecoObstetricos });
    const schema = pacienteFechaNacimiento
      ? getAnamnesisSchemaForPatient(pacienteFechaNacimiento)
      : CreateAnamnesisSchema;
    return schema.safeParse(payload);
  }, [form, pacienteFechaNacimiento, showGinecoObstetricos]);
  const allErrors = validation.success ? {} : firstFieldErrors(validation.error);
  const serverErrors = submission?.form === form && submission.actionState !== actionState
    ? actionState.errors ?? {}
    : {};
  const showValidation = !isPending && !actionState.ok;
  const visibleErrors = Object.fromEntries(
    Object.entries({ ...serverErrors, ...allErrors }).filter(([path]) => showValidation && (submitted || touched.has(path))),
  );
  const warnings: Record<string, string> = {};
  const gineco = form.antecedentesGinecoObstetricos;
  if (gineco) {
    const menarca = Number(gineco.menarca);
    const menopausia = Number(gineco.edadMenopausia);
    const gestaciones = Number(gineco.gestaciones);
    if (gineco.menarca && (menarca < 8 || menarca > 15)) warnings["antecedentesGinecoObstetricos.menarca"] = "Edad inusual; revisa el dato antes de guardar.";
    if (gineco.edadMenopausia && menopausia < 40) warnings["antecedentesGinecoObstetricos.edadMenopausia"] = "Menopausia temprana; revisa el dato antes de guardar.";
    if (gineco.gestaciones && gestaciones > 15) warnings["antecedentesGinecoObstetricos.gestaciones"] = "Conteo inusual; revisa el dato antes de guardar.";
  }
  const visibleWarnings = Object.fromEntries(Object.entries(warnings).filter(([path]) => showValidation && (submitted || touched.has(path))));
  const sections = [
    { id: "contexto", label: "Contexto social", prefixes: ["estadoCivil", "nivelEducativo", "añosCursados", "situacionLaboral"] },
    { id: "consulta", label: "Consulta actual", prefixes: ["motivoConsulta", "historiaEnfermedadActual"] },
    { id: "habitos", label: "Hábitos y estilo de vida", prefixes: ["antecedentesNoPatologicos"] },
    { id: "personales", label: "Antecedentes personales", prefixes: ["antecedentesPatologicos.personales"] },
    { id: "familiares", label: "Antecedentes familiares", prefixes: ["antecedentesPatologicos.familiares"] },
    ...(showGinecoObstetricos ? [{ id: "gineco", label: "Gineco-obstétricos", prefixes: ["antecedentesGinecoObstetricos"] }] : []),
  ];

  useEffect(() => {
    if (!actionState.message) {
      return;
    }

    if (actionState.ok) {
      toast.success(actionState.message);
      if (successRedirectHref) {
        router.push(successRedirectHref);
      }
      return;
    }

    if (!actionState.errors) {
      toast.error(actionState.message);
    }
  }, [actionState, router, successRedirectHref]);

  if (actionState.ok && successRedirectHref) {
    return <p className="text-sm text-muted-foreground" role="status">Historia guardada. Redirigiendo...</p>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (activeStep < sections.length - 1) {
      event.preventDefault();
      goToStep(activeStep + 1);
      return;
    }
    setSubmitted(true);
    setSubmission({ form, actionState });
    if (!validation.success) {
      event.preventDefault();
      const firstPath = Object.keys(allErrors)[0];
      const errorStep = sections.findIndex((section) => section.prefixes.some((prefix) => firstPath === prefix || firstPath.startsWith(`${prefix}.`)));
      if (errorStep >= 0) setActiveStep(errorStep);
      const control = firstPath?.includes(".enfermedad.")
        ? firstPath.slice(0, firstPath.indexOf(".enfermedad.") + ".enfermedad".length)
        : firstPath;
      window.requestAnimationFrame(() => document.getElementById(control)?.focus());
      return;
    }

    if (!confirmSubmit(event, getConfirmationSections(form, showGinecoObstetricos))) {
      return;
    }
  }

  function goToStep(index: number) {
    setActiveStep(index);
    window.requestAnimationFrame(() => {
      const heading = document.getElementById(`anamnesis-${sections[index].id}-title`);
      heading?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }

  return (
    <form
      action={formAction}
      className="grid scroll-mt-20 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6"
      noValidate
      onBlurCapture={(event) => {
        const control = event.target as HTMLElement;
        const path = control.id || control.getAttribute("name");
        if (path) setTouched((current) => new Set(current).add(path));
      }}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <nav aria-label="Pasos de anamnesis" className="rounded-xl border bg-muted/20 p-3 lg:sticky lg:top-20">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">En esta anamnesis</p>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {sections.map((section, index) => {
            const errorCount = Object.keys(visibleErrors).filter((path) => section.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))).length;
            return (
              <li key={section.id} className="shrink-0 lg:shrink">
                <button type="button" disabled={isPending} aria-current={activeStep === index ? "step" : undefined} aria-controls={`anamnesis-${section.id}`} onClick={() => goToStep(index)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", activeStep === index && "bg-accent font-semibold text-accent-foreground", errorCount > 0 && "text-destructive")}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums text-muted-foreground", activeStep === index && "border-primary bg-primary text-primary-foreground")}>{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{section.label}</span>
                  {errorCount > 0 ? <span className="text-xs" aria-label={`${errorCount} errores`}>({errorCount})</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="hidden px-2 pt-4 text-xs leading-relaxed text-muted-foreground lg:block">Puedes cambiar de paso sin perder lo escrito. Guarda al finalizar.</p>
      </nav>
      <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p aria-live="polite">Paso {activeStep + 1} de {sections.length} · {sections[activeStep].label}</p>
          <p>* Campos obligatorios</p>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {sections.map((section, index) => <span key={section.id} className={cn("h-1 flex-1 rounded-full bg-muted", index <= activeStep && "bg-primary")} />)}
        </div>
      </div>
      <FormSection
        hidden={activeStep !== 0}
        id="contexto"
        number="01"
        description="Situación familiar, educación y ocupación del paciente."
        title="Contexto social"
      >
        <FieldGrid>
          <Input
            name="pacienteId"
            type="hidden"
            value={form.pacienteId}
          />
          <SelectField
            error={visibleErrors.estadoCivil}
            label="Estado civil"
            name="estadoCivil"
            onChange={(value) =>
              setForm((current) => ({ ...current, estadoCivil: value }))
            }
            options={estadosCiviles}
            required
            value={form.estadoCivil}
          />
          <SelectField
            error={visibleErrors.nivelEducativo}
            label="Nivel educativo"
            name="nivelEducativo"
            onChange={(value) =>
              setForm((current) => ({ ...current, nivelEducativo: value }))
            }
            options={nivelesEducativos}
            required
            value={form.nivelEducativo}
          />
          <TextField
            error={visibleErrors.añosCursados}
            label="Años cursados"
            min={0}
            name="añosCursados"
            onChange={(value) =>
              setForm((current) => ({ ...current, añosCursados: value }))
            }
            type="number"
            value={form.añosCursados}
          />
          <TextField
            error={visibleErrors.situacionLaboral}
            label="Situacion laboral"
            name="situacionLaboral"
            onChange={(value) =>
              setForm((current) => ({ ...current, situacionLaboral: value }))
            }
            value={form.situacionLaboral}
          />
        </FieldGrid>
      </FormSection>
      <FormSection hidden={activeStep !== 1} id="consulta" number="02" title="Consulta actual" description="Registra el motivo de atención y la evolución de los síntomas.">
        <FieldGroup className="grid gap-5">
          <TextareaField
            error={visibleErrors.motivoConsulta}
            label="Motivo de consulta"
            placeholder="Describe la razón principal por la que el paciente consulta."
            name="motivoConsulta"
            onChange={(value) =>
              setForm((current) => ({ ...current, motivoConsulta: value }))
            }
            required
            rows={5}
            value={form.motivoConsulta}
          />
          <TextareaField
            error={visibleErrors.historiaEnfermedadActual}
            label="Historia de enfermedad actual"
            placeholder="Describe el inicio, la duración y la evolución de los síntomas."
            name="historiaEnfermedadActual"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                historiaEnfermedadActual: value,
              }))
            }
            required
            rows={5}
            value={form.historiaEnfermedadActual}
          />
        </FieldGroup>
      </FormSection>

      <FormSection
        id="habitos"
        hidden={activeStep !== 2}
        number="03"
        description="Antecedentes no patológicos relevantes para el seguimiento clínico."
        title="Hábitos y estilo de vida"
      >
        <FieldGrid>
          <SelectField
            error={visibleErrors["antecedentesNoPatologicos.habitoTabaquico"]}
            label="Habito tabaquico"
            name="antecedentesNoPatologicos.habitoTabaquico"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                antecedentesNoPatologicos: {
                  ...current.antecedentesNoPatologicos,
                  habitoTabaquico: value,
                },
              }))
            }
            options={habitosTabaco}
            required
            value={form.antecedentesNoPatologicos.habitoTabaquico}
          />
          <SelectField
            error={visibleErrors["antecedentesNoPatologicos.consumoAlcohol"]}
            label="Consumo de alcohol"
            name="antecedentesNoPatologicos.consumoAlcohol"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                antecedentesNoPatologicos: {
                  ...current.antecedentesNoPatologicos,
                  consumoAlcohol: value,
                },
              }))
            }
            options={consumosAlcohol}
            required
            value={form.antecedentesNoPatologicos.consumoAlcohol}
          />
          <SelectField
            error={
              visibleErrors["antecedentesNoPatologicos.consumoFrutasVerduras"]
            }
            label="Frutas y verduras"
            name="antecedentesNoPatologicos.consumoFrutasVerduras"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                antecedentesNoPatologicos: {
                  ...current.antecedentesNoPatologicos,
                  consumoFrutasVerduras: value,
                },
              }))
            }
            options={porcionesFrutasVerduras}
            required
            value={form.antecedentesNoPatologicos.consumoFrutasVerduras}
          />
          <CheckboxField
            checked={form.antecedentesNoPatologicos.realizaActividadFisica}
            label="Realiza actividad fisica"
            name="antecedentesNoPatologicos.realizaActividadFisica"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                antecedentesNoPatologicos: {
                  ...current.antecedentesNoPatologicos,
                  realizaActividadFisica: checked,
                },
              }))
            }
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        action={
          <Button
            onClick={() =>
              setForm((current) => ({
                ...current,
                antecedentesPatologicos: {
                  ...current.antecedentesPatologicos,
                  personales: [
                    ...current.antecedentesPatologicos.personales,
                    createPersonal(),
                  ],
                },
              }))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon data-icon="inline-start" />
            Agregar
          </Button>
        }
        description="Enfermedades o diagnosticos previos del paciente."
        id="personales"
        hidden={activeStep !== 3}
        number="04"
        title="Antecedentes patológicos personales"
      >
        <PathologyList
          emptyText="Sin antecedentes personales registrados."
          items={form.antecedentesPatologicos.personales}
          onRemove={(index) => {
            setTouched(new Set());
            setForm((current) => ({
              ...current,
              antecedentesPatologicos: {
                ...current.antecedentesPatologicos,
                personales: current.antecedentesPatologicos.personales.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              },
            }));
          }}
          renderItem={(item, index) => (
            <FieldGrid>
              <DiseaseFields
                baseName={`antecedentesPatologicos.personales.${index}.enfermedad`}
                errorBase={`antecedentesPatologicos.personales.${index}.enfermedad`}
                errors={visibleErrors}
                label="Enfermedad"
                onChange={(enfermedad) =>
                  setForm((current) => ({
                    ...current,
                    antecedentesPatologicos: {
                      ...current.antecedentesPatologicos,
                      personales:
                        current.antecedentesPatologicos.personales.map(
                          (personal, personalIndex) =>
                            personalIndex === index
                              ? {
                                  ...personal,
                                  enfermedad,
                                }
                              : personal,
                        ),
                    },
                  }))
                }
                value={item.enfermedad}
              />
              <DateField
                error={
                  visibleErrors[
                    `antecedentesPatologicos.personales.${index}.fechaDiagnostico`
                  ]
                }
                label="Fecha de diagnostico"
                name={`antecedentesPatologicos.personales.${index}.fechaDiagnostico`}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    antecedentesPatologicos: {
                      ...current.antecedentesPatologicos,
                      personales:
                        current.antecedentesPatologicos.personales.map(
                          (personal, personalIndex) =>
                            personalIndex === index
                              ? { ...personal, fechaDiagnostico: value }
                              : personal,
                        ),
                    },
                  }))
                }
                value={item.fechaDiagnostico}
              />
              <TextField
                error={
                  visibleErrors[
                    `antecedentesPatologicos.personales.${index}.tratamiento`
                  ]
                }
                label="Tratamiento"
                name={`antecedentesPatologicos.personales.${index}.tratamiento`}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    antecedentesPatologicos: {
                      ...current.antecedentesPatologicos,
                      personales:
                        current.antecedentesPatologicos.personales.map(
                          (personal, personalIndex) =>
                            personalIndex === index
                              ? { ...personal, tratamiento: value }
                              : personal,
                        ),
                    },
                  }))
                }
                value={item.tratamiento}
              />
            </FieldGrid>
          )}
        />
      </FormSection>

      <FormSection
        action={
          <Button
            onClick={() =>
              setForm((current) => ({
                ...current,
                antecedentesPatologicos: {
                  ...current.antecedentesPatologicos,
                  familiares: [
                    ...current.antecedentesPatologicos.familiares,
                    createFamiliar(),
                  ],
                },
              }))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon data-icon="inline-start" />
            Agregar
          </Button>
        }
        description="Antecedentes familiares clinicamente relevantes."
        id="familiares"
        hidden={activeStep !== 4}
        number="05"
        title="Antecedentes familiares"
      >
        <PathologyList
          emptyText="Sin antecedentes familiares registrados."
          items={form.antecedentesPatologicos.familiares}
          onRemove={(index) => {
            setTouched(new Set());
            setForm((current) => ({
              ...current,
              antecedentesPatologicos: {
                ...current.antecedentesPatologicos,
                familiares: current.antecedentesPatologicos.familiares.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              },
            }));
          }}
          renderItem={(item, index) => (
            <div className="flex flex-col gap-4">
              <FieldGrid>
                <TextField
                  error={
                    visibleErrors[
                      `antecedentesPatologicos.familiares.${index}.parentesco`
                    ]
                  }
                  label="Parentesco"
                  name={`antecedentesPatologicos.familiares.${index}.parentesco`}
                  onChange={(value) =>
                    updateFamiliar(index, { parentesco: value })
                  }
                  required
                  value={item.parentesco}
                />
                <TextField
                  error={
                    visibleErrors[
                      `antecedentesPatologicos.familiares.${index}.edadDiagnostico`
                    ]
                  }
                  label="Edad de diagnostico"
                  min={0}
                  name={`antecedentesPatologicos.familiares.${index}.edadDiagnostico`}
                  onChange={(value) =>
                    updateFamiliar(index, { edadDiagnostico: value })
                  }
                  required
                  type="number"
                  value={item.edadDiagnostico}
                />
                <TextField
                  error={
                    visibleErrors[
                      `antecedentesPatologicos.familiares.${index}.edadFallecimiento`
                    ]
                  }
                  label="Edad de fallecimiento"
                  min={0}
                  name={`antecedentesPatologicos.familiares.${index}.edadFallecimiento`}
                  onChange={(value) =>
                    updateFamiliar(index, { edadFallecimiento: value })
                  }
                  type="number"
                  value={item.edadFallecimiento}
                />
                <CheckboxField
                  checked={item.fallecimiento}
                  label="Fallecimiento"
                  name={`antecedentesPatologicos.familiares.${index}.fallecimiento`}
                  onChange={(checked) =>
                    updateFamiliar(index, { fallecimiento: checked })
                  }
                />
              </FieldGrid>
              <FieldGrid>
                <DiseaseFields
                  baseName={`antecedentesPatologicos.familiares.${index}.enfermedad`}
                  errorBase={`antecedentesPatologicos.familiares.${index}.enfermedad`}
                  errors={visibleErrors}
                  label="Enfermedad familiar"
                  onChange={(enfermedad) => updateFamiliar(index, { enfermedad })}
                  value={item.enfermedad}
                />
              </FieldGrid>
            </div>
          )}
        />
      </FormSection>

      {showGinecoObstetricos ? (
        <FormSection
          action={
            <CheckboxField
              checked={Boolean(form.antecedentesGinecoObstetricos)}
              label="Incluir"
              name="habilitarAntecedentesGinecoObstetricos"
              onChange={(checked) => {
                if (!checked) {
                  setTouched((current) => new Set([...current].filter((path) => !path.startsWith("antecedentesGinecoObstetricos."))));
                }
                setForm((current) => ({
                  ...current,
                  antecedentesGinecoObstetricos: checked
                    ? { ...emptyGineco }
                    : undefined,
                }));
              }}
            />
          }
          description="Completar cuando corresponda por el contexto clinico."
          id="gineco"
          hidden={activeStep !== 5}
          number="06"
          title="Antecedentes gineco-obstétricos"
        >
          {form.antecedentesGinecoObstetricos ? (
            <GinecoFields
              errors={visibleErrors}
              warnings={visibleWarnings}
              onChange={(patch) =>
                setForm((current) => ({
                  ...current,
                  antecedentesGinecoObstetricos: {
                    ...current.antecedentesGinecoObstetricos!,
                    ...patch,
                  },
                }))
              }
              value={form.antecedentesGinecoObstetricos}
            />
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              Activa “Incluir” para registrar estos antecedentes cuando corresponda.
            </div>
          )}
        </FormSection>
      ) : null}

      <footer className="sticky bottom-0 flex flex-col gap-4 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? (Object.keys(visibleErrors).length > 0 ? `Revisa ${Object.keys(visibleErrors).length} campos señalados antes de guardar.` : "Al guardar podrás revisar la información antes de confirmar.")}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            disabled={isPending}
            onClick={() => {
              setForm(initialValue);
              setTouched(new Set());
              setSubmitted(false);
              setSubmission(null);
              goToStep(0);
            }}
            type="button"
            variant="ghost"
          >
            Limpiar
          </Button>
          <div className="flex items-center gap-2">
          <Button disabled={isPending || activeStep === 0} type="button" variant="outline" onClick={() => goToStep(activeStep - 1)}>
            <ArrowLeftIcon data-icon="inline-start" />Anterior
          </Button>
          {activeStep < sections.length - 1 ? (
            <Button disabled={isPending} type="button" onClick={() => goToStep(activeStep + 1)}>
              Siguiente<ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : <Button disabled={isPending} type="submit">
            <SaveIcon data-icon="inline-start" />
            {isPending ? "Guardando..." : "Guardar anamnesis"}
          </Button>}
          </div>
        </div>
      </footer>
      </div>
      {confirmationDialog}
    </form>
  );

  function updateFamiliar(
    index: number,
    patch: Partial<AntecedenteFamiliarForm>,
  ) {
    setForm((current) => ({
      ...current,
      antecedentesPatologicos: {
        ...current.antecedentesPatologicos,
        familiares: current.antecedentesPatologicos.familiares.map(
          (familiar, familiarIndex) =>
            familiarIndex === index ? { ...familiar, ...patch } : familiar,
        ),
      },
    }));
  }
}

function DiseaseFields({
  baseName,
  errorBase,
  errors,
  label,
  onChange,
  value,
}: {
  baseName: string;
  errorBase: string;
  errors: Record<string, string>;
  label: string;
  onChange: (value: EnfermedadForm) => void;
  value: EnfermedadForm;
}) {
  return (
    <IcdCodePicker
      baseName={baseName}
      error={
        errors[`${errorBase}.code`] ??
        errors[`${errorBase}.title`] ??
        errors[`${errorBase}.iNo`] ??
        errors[errorBase]
      }
      label={label}
      onChange={onChange}
      value={value}
    />
  );
}

function PathologyList<T>({
  emptyText,
  items,
  onRemove,
  renderItem,
}: {
  emptyText: string;
  items: T[];
  onRemove: (index: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, index) => (
        <fieldset
          className="flex flex-col gap-4 rounded-md border bg-background p-4"
          key={index}
        >
          <div className="flex items-center justify-between gap-3">
            <legend className="text-sm font-medium">Registro {index + 1}</legend>
            <Button
              onClick={() => onRemove(index)}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              Quitar
            </Button>
          </div>
          {renderItem(item, index)}
        </fieldset>
      ))}
    </div>
  );
}

function GinecoFields({
  errors,
  warnings,
  onChange,
  value,
}: {
  errors: Record<string, string>;
  warnings: Record<string, string>;
  onChange: (patch: Partial<GinecoObstetricosForm>) => void;
  value: GinecoObstetricosForm;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FieldGrid>
        <SelectField
          error={errors["antecedentesGinecoObstetricos.estadioTanner"]}
          label="Estadio Tanner"
          name="antecedentesGinecoObstetricos.estadioTanner"
          onChange={(nextValue) => onChange({ estadioTanner: nextValue })}
          options={["1", "2", "3", "4", "5", "No evaluado"]}
          required
          value={value.estadioTanner}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.menarca"]}
          label="Menarca"
          min={1}
          name="antecedentesGinecoObstetricos.menarca"
          onChange={(nextValue) => onChange({ menarca: nextValue })}
          type="number"
          value={value.menarca}
          warning={warnings["antecedentesGinecoObstetricos.menarca"]}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.ritmoMenstrual"]}
          label="Ritmo menstrual"
          name="antecedentesGinecoObstetricos.ritmoMenstrual"
          onChange={(nextValue) => onChange({ ritmoMenstrual: nextValue })}
          value={value.ritmoMenstrual}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.gestaciones"]}
          label="Gestaciones"
          min={0}
          name="antecedentesGinecoObstetricos.gestaciones"
          onChange={(nextValue) => onChange({ gestaciones: nextValue })}
          required
          type="number"
          value={value.gestaciones}
          warning={warnings["antecedentesGinecoObstetricos.gestaciones"]}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.partos"]}
          label="Partos"
          min={0}
          name="antecedentesGinecoObstetricos.partos"
          onChange={(nextValue) => onChange({ partos: nextValue })}
          required
          type="number"
          value={value.partos}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.abortos"]}
          label="Abortos"
          min={0}
          name="antecedentesGinecoObstetricos.abortos"
          onChange={(nextValue) => onChange({ abortos: nextValue })}
          required
          type="number"
          value={value.abortos}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.cesareas"]}
          label="Cesareas"
          min={0}
          name="antecedentesGinecoObstetricos.cesareas"
          onChange={(nextValue) => onChange({ cesareas: nextValue })}
          required
          type="number"
          value={value.cesareas}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.edadMenopausia"]}
          label="Edad menopausia"
          min={1}
          name="antecedentesGinecoObstetricos.edadMenopausia"
          onChange={(nextValue) => onChange({ edadMenopausia: nextValue })}
          type="number"
          value={value.edadMenopausia}
          warning={warnings["antecedentesGinecoObstetricos.edadMenopausia"]}
        />
      </FieldGrid>
      <FieldGrid>
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaUltimaGestacion"]}
          label="Ultima gestacion"
          name="antecedentesGinecoObstetricos.fechaUltimaGestacion"
          onChange={(nextValue) => onChange({ fechaUltimaGestacion: nextValue })}
          value={value.fechaUltimaGestacion}
        />
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaUltimoParto"]}
          label="Ultimo parto"
          name="antecedentesGinecoObstetricos.fechaUltimoParto"
          onChange={(nextValue) => onChange({ fechaUltimoParto: nextValue })}
          value={value.fechaUltimoParto}
        />
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaUltimoAborto"]}
          label="Ultimo aborto"
          name="antecedentesGinecoObstetricos.fechaUltimoAborto"
          onChange={(nextValue) => onChange({ fechaUltimoAborto: nextValue })}
          value={value.fechaUltimoAborto}
        />
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaUltimaCesarea"]}
          label="Ultima cesarea"
          name="antecedentesGinecoObstetricos.fechaUltimaCesarea"
          onChange={(nextValue) => onChange({ fechaUltimaCesarea: nextValue })}
          value={value.fechaUltimaCesarea}
        />
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaPapanicolau"]}
          label="Fecha Papanicolau"
          name="antecedentesGinecoObstetricos.fechaPapanicolau"
          onChange={(nextValue) => onChange({ fechaPapanicolau: nextValue })}
          value={value.fechaPapanicolau}
        />
      </FieldGrid>
      <FieldGrid>
        <CheckboxField
          checked={value.terapiaAnticonceptiva}
          label="Terapia anticonceptiva"
          name="antecedentesGinecoObstetricos.terapiaAnticonceptiva"
          onChange={(checked) => onChange({ terapiaAnticonceptiva: checked })}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.metodoAnticonceptivo"]}
          label="Metodo anticonceptivo"
          name="antecedentesGinecoObstetricos.metodoAnticonceptivo"
          onChange={(nextValue) => onChange({ metodoAnticonceptivo: nextValue })}
          value={value.metodoAnticonceptivo}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.inicioVidaSexual"]}
          label="Inicio vida sexual"
          min={1}
          name="antecedentesGinecoObstetricos.inicioVidaSexual"
          onChange={(nextValue) => onChange({ inicioVidaSexual: nextValue })}
          type="number"
          value={value.inicioVidaSexual}
        />
        <TextField
          error={
            errors["antecedentesGinecoObstetricos.numeroParejasSexuales"]
          }
          label="Numero parejas sexuales"
          min={0}
          name="antecedentesGinecoObstetricos.numeroParejasSexuales"
          onChange={(nextValue) =>
            onChange({ numeroParejasSexuales: nextValue })
          }
          type="number"
          value={value.numeroParejasSexuales}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.cirugiaPelviana"]}
          label="Cirugia pelviana"
          name="antecedentesGinecoObstetricos.cirugiaPelviana"
          onChange={(nextValue) => onChange({ cirugiaPelviana: nextValue })}
          value={value.cirugiaPelviana}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.resultadoPapanicolau"]}
          label="Resultado Papanicolau"
          name="antecedentesGinecoObstetricos.resultadoPapanicolau"
          onChange={(nextValue) => onChange({ resultadoPapanicolau: nextValue })}
          value={value.resultadoPapanicolau}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.colposcopia"]}
          label="Colposcopia"
          name="antecedentesGinecoObstetricos.colposcopia"
          onChange={(nextValue) => onChange({ colposcopia: nextValue })}
          value={value.colposcopia}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.biopsiaCervical"]}
          label="Biopsia cervical"
          name="antecedentesGinecoObstetricos.biopsiaCervical"
          onChange={(nextValue) => onChange({ biopsiaCervical: nextValue })}
          value={value.biopsiaCervical}
        />
      </FieldGrid>
    </div>
  );
}

function CheckboxField({
  checked,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2">
      <Checkbox
        checked={checked}
        name={name}
        onCheckedChange={(nextValue) => onChange(nextValue === true)}
        value="true"
      />
      <Label>{label}</Label>
    </div>
  );
}

function FormSection({
  hidden,
  id,
  number,
  action,
  children,
  description,
  title,
}: {
  hidden: boolean;
  id: string;
  number: string;
  action?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section hidden={hidden} id={`anamnesis-${id}`} aria-labelledby={`anamnesis-${id}-title`} className="scroll-mt-24 rounded-xl border bg-background p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold tabular-nums text-primary">{number}</span>
          <div className="flex flex-col gap-1">
            <h2 tabIndex={-1} id={`anamnesis-${id}-title`} className="text-lg font-semibold tracking-tight outline-none">{title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <FieldGroup className="grid gap-5 md:grid-cols-2 [&_[data-slot=select-trigger]]:w-full">{children}</FieldGroup>
  );
}
