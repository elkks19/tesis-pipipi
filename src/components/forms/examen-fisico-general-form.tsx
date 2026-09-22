"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { SelectField, TextField } from "@/components/forms/fields";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { Button } from "@/components/ui/button";
import {
  textSummary,
  useSubmitConfirmation,
} from "@/components/forms/submit-confirmation";
import {
  CreateExamenFisicoGeneralSchema,
  diagnosticosIMC,
} from "@/lib/schema/examenFisicoGeneral";

type Emptyable<T extends string> = T | "";

export type ExamenFisicoGeneralFormValue = {
  presionArterial: {
    derecha: {
      min: string;
      max: string;
    };
    izquierda: {
      min: string;
      max: string;
    };
  };
  presionArterialMedia: string;
  pulsos: string;
  frecuenciaRespiratoria: string;
  frecuenciaCardiaca: string;
  temperaturaAxilar: string;
  peso: string;
  talla: string;
  imc: string;
  perimetroCadera: string;
  perimetroCintura: string;
  indiceCinturaCadera: string;
  diagnosticoIMC: Emptyable<(typeof diagnosticosIMC)[number]>;
};

type ExamenFisicoGeneralActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type ExamenFisicoGeneralAction = (
  previousState: ExamenFisicoGeneralActionState,
  formData: FormData,
) => Promise<ExamenFisicoGeneralActionState>;

type ExamenFisicoGeneralFormProps = {
  action?: ExamenFisicoGeneralAction;
  defaultValue?: Partial<ExamenFisicoGeneralFormValue>;
  successRedirectHref?: string;
};

const baseFormValue: ExamenFisicoGeneralFormValue = {
  presionArterial: {
    derecha: {
      min: "",
      max: "",
    },
    izquierda: {
      min: "",
      max: "",
    },
  },
  presionArterialMedia: "",
  pulsos: "",
  frecuenciaRespiratoria: "",
  frecuenciaCardiaca: "",
  temperaturaAxilar: "",
  peso: "",
  talla: "",
  imc: "",
  perimetroCadera: "",
  perimetroCintura: "",
  indiceCinturaCadera: "",
  diagnosticoIMC: "",
};

async function noopAction(): Promise<ExamenFisicoGeneralActionState> {
  return { ok: false };
}

function toNumber(value: string) {
  return value.trim().length > 0 ? Number(value) : Number.NaN;
}

function formatDecimal(value: number, decimals = 2) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(decimals);
}

function calculateMeanPressure(state: ExamenFisicoGeneralFormValue) {
  const maxDerecha = toNumber(state.presionArterial.derecha.max);
  const minDerecha = toNumber(state.presionArterial.derecha.min);
  const maxIzquierda = toNumber(state.presionArterial.izquierda.max);
  const minIzquierda = toNumber(state.presionArterial.izquierda.min);
  const pressures = [
    Number.isFinite(maxDerecha) && Number.isFinite(minDerecha)
      ? (maxDerecha + 2 * minDerecha) / 3
      : Number.NaN,
    Number.isFinite(maxIzquierda) && Number.isFinite(minIzquierda)
      ? (maxIzquierda + 2 * minIzquierda) / 3
      : Number.NaN,
  ].filter(Number.isFinite);

  if (pressures.length === 0) {
    return "";
  }

  return formatDecimal(
    pressures.reduce((total, pressure) => total + pressure, 0) /
      pressures.length,
    1,
  );
}

function calculateBmi(state: ExamenFisicoGeneralFormValue) {
  const peso = toNumber(state.peso);
  const tallaCentimetros = toNumber(state.talla);

  if (!Number.isFinite(peso) || !Number.isFinite(tallaCentimetros)) {
    return "";
  }

  const tallaMetros = tallaCentimetros / 100;

  if (tallaMetros <= 0) {
    return "";
  }

  return formatDecimal(peso / tallaMetros ** 2);
}

function calculateWaistHipIndex(state: ExamenFisicoGeneralFormValue) {
  const cintura = toNumber(state.perimetroCintura);
  const cadera = toNumber(state.perimetroCadera);

  if (!Number.isFinite(cintura) || !Number.isFinite(cadera) || cadera <= 0) {
    return "";
  }

  return formatDecimal(cintura / cadera);
}

function buildPayload(state: ExamenFisicoGeneralFormValue) {
  return {
    presionArterial: {
      derecha: {
        min: toNumber(state.presionArterial.derecha.min),
        max: toNumber(state.presionArterial.derecha.max),
      },
      izquierda: {
        min: toNumber(state.presionArterial.izquierda.min),
        max: toNumber(state.presionArterial.izquierda.max),
      },
    },
    presionArterialMedia: toNumber(state.presionArterialMedia),
    pulsos: toNumber(state.pulsos),
    frecuenciaRespiratoria: toNumber(state.frecuenciaRespiratoria),
    frecuenciaCardiaca: toNumber(state.frecuenciaCardiaca),
    temperaturaAxilar: toNumber(state.temperaturaAxilar),
    peso: toNumber(state.peso),
    talla: toNumber(state.talla),
    imc: toNumber(state.imc),
    perimetroCadera: toNumber(state.perimetroCadera),
    perimetroCintura: toNumber(state.perimetroCintura),
    indiceCinturaCadera: toNumber(state.indiceCinturaCadera),
    diagnosticoIMC: state.diagnosticoIMC,
  };
}

function createInitialValue(defaultValue?: Partial<ExamenFisicoGeneralFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
    presionArterial: {
      derecha: {
        ...baseFormValue.presionArterial.derecha,
        ...defaultValue?.presionArterial?.derecha,
      },
      izquierda: {
        ...baseFormValue.presionArterial.izquierda,
        ...defaultValue?.presionArterial?.izquierda,
      },
    },
  };
}

function getConfirmationSections(form: ExamenFisicoGeneralFormValue) {
  return [
    {
      title: "Presion arterial",
      items: [
        {
          label: "Brazo derecho",
          value: textSummary(
            `${form.presionArterial.derecha.max}/${form.presionArterial.derecha.min} mmHg`,
          ),
        },
        {
          label: "Brazo izquierdo",
          value: textSummary(
            `${form.presionArterial.izquierda.max}/${form.presionArterial.izquierda.min} mmHg`,
          ),
        },
        {
          label: "Presion arterial media",
          value: textSummary(`${form.presionArterialMedia} mmHg`),
        },
      ],
    },
    {
      title: "Signos vitales",
      items: [
        { label: "Pulsos", value: textSummary(`${form.pulsos} lpm`) },
        {
          label: "Frecuencia respiratoria",
          value: textSummary(`${form.frecuenciaRespiratoria} rpm`),
        },
        {
          label: "Frecuencia cardiaca",
          value: textSummary(`${form.frecuenciaCardiaca} lpm`),
        },
        {
          label: "Temperatura axilar",
          value: textSummary(`${form.temperaturaAxilar} C`),
        },
      ],
    },
    {
      title: "Antropometria",
      items: [
        { label: "Peso", value: textSummary(`${form.peso} kg`) },
        { label: "Talla", value: textSummary(`${form.talla} cm`) },
        { label: "IMC", value: textSummary(form.imc) },
        { label: "Diagnostico IMC", value: textSummary(form.diagnosticoIMC) },
        {
          label: "Indice cintura/cadera",
          value: textSummary(form.indiceCinturaCadera),
        },
      ],
    },
  ];
}

export function ExamenFisicoGeneralForm({
  action,
  defaultValue,
  successRedirectHref,
}: ExamenFisicoGeneralFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] =
    useState<ExamenFisicoGeneralFormValue>(initialValue);
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: "Guardar examen general",
    });
  const validation = CreateExamenFisicoGeneralSchema.safeParse(buildPayload(form));
  const { visibleErrors, onBlurCapture, revealErrors, showWarning } = useInteractiveErrors({
    value: form,
    actionState,
    isPending,
    validationError: validation.success ? undefined : validation.error,
  });

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const nextForm = {
      ...form,
      imc: calculateBmi(form),
      indiceCinturaCadera: calculateWaistHipIndex(form),
      presionArterialMedia: calculateMeanPressure(form),
    };
    if (revealErrors(event)) {
      return;
    }

    setForm(nextForm);

    if (!confirmSubmit(event, getConfirmationSections(nextForm))) {
      return;
    }
  }

  function updatePressure(
    side: "derecha" | "izquierda",
    field: "min" | "max",
    value: string,
  ) {
    setForm((current) => {
      const next = {
        ...current,
        presionArterial: {
          ...current.presionArterial,
          [side]: {
            ...current.presionArterial[side],
            [field]: value,
          },
        },
      };

      return {
        ...next,
        presionArterialMedia: calculateMeanPressure(next),
      };
    });
  }

  function updateAnthropometry(
    patch: Partial<ExamenFisicoGeneralFormValue>,
  ) {
    setForm((current) => {
      const next = {
        ...current,
        ...patch,
      };

      return {
        ...next,
        imc: calculateBmi(next),
        indiceCinturaCadera: calculateWaistHipIndex(next),
      };
    });
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6"
      noValidate
      onBlurCapture={onBlurCapture}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <FormSection
        description="Registro bilateral de presion arterial y calculo automatico de presion arterial media."
        title="Presion arterial"
      >
        <FieldGrid>
          <NumberField
            error={visibleErrors["presionArterial.derecha.max"]}
            label="Derecha sistolica"
            name="presionArterial.derecha.max"
            onChange={(value) => updatePressure("derecha", "max", value)}
            suffix="mmHg"
            value={form.presionArterial.derecha.max}
            warning={showWarning("presionArterial.derecha.max") && Number(form.presionArterial.derecha.max) >= 180 ? "Cifra elevada: confirma la medicion y la atencion clinica" : undefined}
          />
          <NumberField
            error={visibleErrors["presionArterial.derecha.min"]}
            label="Derecha diastolica"
            name="presionArterial.derecha.min"
            onChange={(value) => updatePressure("derecha", "min", value)}
            suffix="mmHg"
            value={form.presionArterial.derecha.min}
            warning={showWarning("presionArterial.derecha.min") && Number(form.presionArterial.derecha.min) >= 120 ? "Cifra elevada: confirma la medicion y la atencion clinica" : undefined}
          />
          <NumberField
            error={visibleErrors["presionArterial.izquierda.max"]}
            label="Izquierda sistolica"
            name="presionArterial.izquierda.max"
            onChange={(value) => updatePressure("izquierda", "max", value)}
            suffix="mmHg"
            value={form.presionArterial.izquierda.max}
            warning={showWarning("presionArterial.izquierda.max") && Number(form.presionArterial.izquierda.max) >= 180 ? "Cifra elevada: confirma la medicion y la atencion clinica" : undefined}
          />
          <NumberField
            error={visibleErrors["presionArterial.izquierda.min"]}
            label="Izquierda diastolica"
            name="presionArterial.izquierda.min"
            onChange={(value) => updatePressure("izquierda", "min", value)}
            suffix="mmHg"
            value={form.presionArterial.izquierda.min}
            warning={showWarning("presionArterial.izquierda.min") && Number(form.presionArterial.izquierda.min) >= 120 ? "Cifra elevada: confirma la medicion y la atencion clinica" : undefined}
          />
          <NumberField
            error={visibleErrors.presionArterialMedia}
            label="Presion arterial media"
            name="presionArterialMedia"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                presionArterialMedia: value,
              }))
            }
            suffix="mmHg"
            value={form.presionArterialMedia}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        description="Constantes basales registradas durante la estacion."
        title="Signos vitales"
      >
        <FieldGrid>
          <NumberField
            error={visibleErrors.pulsos}
            label="Pulsos"
            name="pulsos"
            onChange={(value) =>
              setForm((current) => ({ ...current, pulsos: value }))
            }
            suffix="lpm"
            value={form.pulsos}
          />
          <NumberField
            error={visibleErrors.frecuenciaRespiratoria}
            label="Frecuencia respiratoria"
            name="frecuenciaRespiratoria"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                frecuenciaRespiratoria: value,
              }))
            }
            suffix="rpm"
            value={form.frecuenciaRespiratoria}
          />
          <NumberField
            error={visibleErrors.frecuenciaCardiaca}
            label="Frecuencia cardiaca"
            name="frecuenciaCardiaca"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                frecuenciaCardiaca: value,
              }))
            }
            suffix="lpm"
            value={form.frecuenciaCardiaca}
          />
          <NumberField
            error={visibleErrors.temperaturaAxilar}
            label="Temperatura axilar"
            name="temperaturaAxilar"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                temperaturaAxilar: value,
              }))
            }
            step="0.1"
            suffix="C"
            value={form.temperaturaAxilar}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        description="Mediciones antropometricas con calculo automatico de IMC e indice cintura/cadera."
        title="Antropometria"
      >
        <FieldGrid>
          <NumberField
            error={visibleErrors.peso}
            label="Peso"
            name="peso"
            onChange={(value) => updateAnthropometry({ peso: value })}
            step="0.1"
            suffix="kg"
            value={form.peso}
          />
          <NumberField
            error={visibleErrors.talla}
            label="Talla"
            name="talla"
            onChange={(value) => updateAnthropometry({ talla: value })}
            step="0.1"
            suffix="cm"
            value={form.talla}
          />
          <NumberField
            error={visibleErrors.imc}
            label="IMC"
            name="imc"
            onChange={(value) => setForm((current) => ({ ...current, imc: value }))}
            step="0.01"
            value={form.imc}
          />
          <NumberField
            error={visibleErrors.perimetroCintura}
            label="Perimetro cintura"
            name="perimetroCintura"
            onChange={(value) =>
              updateAnthropometry({ perimetroCintura: value })
            }
            step="0.1"
            suffix="cm"
            value={form.perimetroCintura}
          />
          <NumberField
            error={visibleErrors.perimetroCadera}
            label="Perimetro cadera"
            name="perimetroCadera"
            onChange={(value) => updateAnthropometry({ perimetroCadera: value })}
            step="0.1"
            suffix="cm"
            value={form.perimetroCadera}
          />
          <NumberField
            error={visibleErrors.indiceCinturaCadera}
            label="Indice cintura/cadera"
            name="indiceCinturaCadera"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                indiceCinturaCadera: value,
              }))
            }
            step="0.01"
            value={form.indiceCinturaCadera}
          />
          <SelectField
            error={visibleErrors.diagnosticoIMC}
            label="Diagnostico IMC"
            name="diagnosticoIMC"
            onChange={(value) =>
              setForm((current) => ({ ...current, diagnosticoIMC: value }))
            }
            options={diagnosticosIMC}
            required
            value={form.diagnosticoIMC}
          />
        </FieldGrid>
      </FormSection>

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-3xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ??
            "Completa los signos vitales y mediciones para guardar."}
        </p>
        <Button disabled={isPending} type="submit">
          <SaveIcon data-icon="inline-start" />
          {isPending ? "Guardando..." : "Guardar examen general"}
        </Button>
      </footer>
      {confirmationDialog}
    </form>
  );
}

function NumberField({
  error,
  label,
  name,
  onChange,
  step = "any",
  suffix,
  value,
  warning,
}: {
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  step?: string;
  suffix?: string;
  value: string;
  warning?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <TextField
        error={error}
        warning={error ? undefined : warning}
        label={label}
        min={0}
        name={name}
        onChange={onChange}
        required
        step={step}
        type="number"
        value={value}
      />
      {suffix ? (
        <span className="-mt-1 text-xs text-muted-foreground">{suffix}</span>
      ) : null}
    </div>
  );
}

function FormSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
