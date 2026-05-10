"use client";

import { useRouter } from "next/navigation";
import {
  type SubmitEvent,
  type ReactNode,
  useEffect,
  useActionState,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";

import {
  DateField,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  consumosAlcohol,
  CreateAnamnesisSchema,
  estadosCiviles,
  habitosTabaco,
  nivelesEducativos,
  porcionesFrutasVerduras,
} from "@/lib/schema/anamnesis";

type Emptyable<T extends string> = T | "";

type EnfermedadForm = {
  iNo: string;
  code: string;
  title: string;
};

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
  anosCursados: string;
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
  anosCursados: "",
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

function buildPayload(state: AnamnesisFormValue) {
  return {
    pacienteId: state.pacienteId.trim(),
    estadoCivil: state.estadoCivil,
    nivelEducativo: state.nivelEducativo,
    anosCursados: optionalNumber(state.anosCursados),
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
    antecedentesGinecoObstetricos: state.antecedentesGinecoObstetricos
      ? {
          ...state.antecedentesGinecoObstetricos,
          menarca: requiredNumber(state.antecedentesGinecoObstetricos.menarca),
          gestaciones: requiredNumber(
            state.antecedentesGinecoObstetricos.gestaciones,
          ),
          partos: requiredNumber(state.antecedentesGinecoObstetricos.partos),
          abortos: requiredNumber(state.antecedentesGinecoObstetricos.abortos),
          cesareas: requiredNumber(state.antecedentesGinecoObstetricos.cesareas),
          edadMenopausia: requiredNumber(
            state.antecedentesGinecoObstetricos.edadMenopausia,
          ),
          inicioVidaSexual: requiredNumber(
            state.antecedentesGinecoObstetricos.inicioVidaSexual,
          ),
          numeroParejasSexuales: requiredNumber(
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
        }
      : undefined,
  };
}

function getErrorMap(error: unknown) {
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

export function AnamnesisForm({
  action,
  defaultValue,
  successRedirectHref,
}: AnamnesisFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<AnamnesisFormValue>(initialValue);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const visibleErrors = {
    ...actionState.errors,
    ...errors,
  };

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

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    const result = CreateAnamnesisSchema.safeParse(buildPayload(form));

    if (!result.success) {
      event.preventDefault();
      setErrors(getErrorMap(result.error));
      return;
    }

    setErrors({});

    if (!action) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <FormSection
        description="Identificacion de la historia y contexto social del paciente."
        title="Datos de anamnesis"
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
            error={visibleErrors.anosCursados}
            label="Anos cursados"
            min={0}
            name="anosCursados"
            onChange={(value) =>
              setForm((current) => ({ ...current, anosCursados: value }))
            }
            type="number"
            value={form.anosCursados}
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
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextareaField
            error={visibleErrors.motivoConsulta}
            label="Motivo de consulta"
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
        </div>
      </FormSection>

      <FormSection
        description="Habitos relevantes para el riesgo y seguimiento clinico."
        title="Antecedentes no patologicos"
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
        title="Antecedentes patologicos personales"
      >
        <PathologyList
          emptyText="Sin antecedentes personales registrados."
          items={form.antecedentesPatologicos.personales}
          onRemove={(index) =>
            setForm((current) => ({
              ...current,
              antecedentesPatologicos: {
                ...current.antecedentesPatologicos,
                personales: current.antecedentesPatologicos.personales.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              },
            }))
          }
          renderItem={(item, index) => (
            <FieldGrid>
              <DiseaseFields
                baseName={`antecedentesPatologicos.personales.${index}.enfermedad`}
                errorBase={`antecedentesPatologicos.personales.${index}.enfermedad`}
                errors={visibleErrors}
                onChange={(field, value) =>
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
                                  enfermedad: {
                                    ...personal.enfermedad,
                                    [field]: value,
                                  },
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
        title="Antecedentes familiares"
      >
        <PathologyList
          emptyText="Sin antecedentes familiares registrados."
          items={form.antecedentesPatologicos.familiares}
          onRemove={(index) =>
            setForm((current) => ({
              ...current,
              antecedentesPatologicos: {
                ...current.antecedentesPatologicos,
                familiares: current.antecedentesPatologicos.familiares.filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              },
            }))
          }
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
                  onChange={(field, value) =>
                    updateFamiliar(index, {
                      enfermedad: {
                        ...item.enfermedad,
                        [field]: value,
                      },
                    })
                  }
                  value={item.enfermedad}
                />
              </FieldGrid>
            </div>
          )}
        />
      </FormSection>

      <FormSection
        action={
          <CheckboxField
            checked={Boolean(form.antecedentesGinecoObstetricos)}
            label="Incluir"
            name="habilitarAntecedentesGinecoObstetricos"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                antecedentesGinecoObstetricos: checked
                  ? { ...emptyGineco }
                  : undefined,
              }))
            }
          />
        }
        description="Completar cuando corresponda por el contexto clinico."
        title="Antecedentes gineco-obstetricos"
      >
        {form.antecedentesGinecoObstetricos ? (
          <GinecoFields
            errors={visibleErrors}
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
            Seccion no incluida.
          </div>
        )}
      </FormSection>

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? "Completa los campos obligatorios."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            disabled={isPending}
            onClick={() => {
              setForm(initialValue);
              setErrors({});
            }}
            type="reset"
            variant="outline"
          >
            Limpiar
          </Button>
          <Button disabled={isPending} type="submit">
            <SaveIcon data-icon="inline-start" />
            {isPending ? "Guardando..." : "Guardar anamnesis"}
          </Button>
        </div>
      </footer>
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
  onChange,
  value,
}: {
  baseName: string;
  errorBase: string;
  errors: Record<string, string>;
  onChange: (field: keyof EnfermedadForm, value: string) => void;
  value: EnfermedadForm;
}) {
  return (
    <>
      <TextField
        error={errors[`${errorBase}.code`]}
        label="Codigo CIE"
        name={`${baseName}.code`}
        onChange={(nextValue) => onChange("code", nextValue)}
        required
        value={value.code}
      />
      <TextField
        error={errors[`${errorBase}.title`]}
        label="Enfermedad"
        name={`${baseName}.title`}
        onChange={(nextValue) => onChange("title", nextValue)}
        required
        value={value.title}
      />
      <TextField
        error={errors[`${errorBase}.iNo`]}
        label="Identificador"
        name={`${baseName}.iNo`}
        onChange={(nextValue) => onChange("iNo", nextValue)}
        required
        value={value.iNo}
      />
    </>
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
  onChange,
  value,
}: {
  errors: Record<string, string>;
  onChange: (patch: Partial<GinecoObstetricosForm>) => void;
  value: GinecoObstetricosForm;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FieldGrid>
        <TextField
          error={errors["antecedentesGinecoObstetricos.estadioTanner"]}
          label="Estadio Tanner"
          name="antecedentesGinecoObstetricos.estadioTanner"
          onChange={(nextValue) => onChange({ estadioTanner: nextValue })}
          required
          value={value.estadioTanner}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.menarca"]}
          label="Menarca"
          min={0}
          name="antecedentesGinecoObstetricos.menarca"
          onChange={(nextValue) => onChange({ menarca: nextValue })}
          required
          type="number"
          value={value.menarca}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.ritmoMenstrual"]}
          label="Ritmo menstrual"
          name="antecedentesGinecoObstetricos.ritmoMenstrual"
          onChange={(nextValue) => onChange({ ritmoMenstrual: nextValue })}
          required
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
          min={0}
          name="antecedentesGinecoObstetricos.edadMenopausia"
          onChange={(nextValue) => onChange({ edadMenopausia: nextValue })}
          required
          type="number"
          value={value.edadMenopausia}
        />
      </FieldGrid>
      <FieldGrid>
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaUltimaGestacion"]}
          label="Ultima gestacion"
          name="antecedentesGinecoObstetricos.fechaUltimaGestacion"
          onChange={(nextValue) => onChange({ fechaUltimaGestacion: nextValue })}
          required
          value={value.fechaUltimaGestacion}
        />
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaUltimoParto"]}
          label="Ultimo parto"
          name="antecedentesGinecoObstetricos.fechaUltimoParto"
          onChange={(nextValue) => onChange({ fechaUltimoParto: nextValue })}
          required
          value={value.fechaUltimoParto}
        />
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaUltimoAborto"]}
          label="Ultimo aborto"
          name="antecedentesGinecoObstetricos.fechaUltimoAborto"
          onChange={(nextValue) => onChange({ fechaUltimoAborto: nextValue })}
          required
          value={value.fechaUltimoAborto}
        />
        <DateField
          error={errors["antecedentesGinecoObstetricos.fechaUltimaCesarea"]}
          label="Ultima cesarea"
          name="antecedentesGinecoObstetricos.fechaUltimaCesarea"
          onChange={(nextValue) => onChange({ fechaUltimaCesarea: nextValue })}
          required
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
          min={0}
          name="antecedentesGinecoObstetricos.inicioVidaSexual"
          onChange={(nextValue) => onChange({ inicioVidaSexual: nextValue })}
          required
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
          required
          type="number"
          value={value.numeroParejasSexuales}
        />
        <TextField
          error={errors["antecedentesGinecoObstetricos.cirugiaPelviana"]}
          label="Cirugia pelviana"
          name="antecedentesGinecoObstetricos.cirugiaPelviana"
          onChange={(nextValue) => onChange({ cirugiaPelviana: nextValue })}
          required
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
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-background p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{title}</h2>
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}
