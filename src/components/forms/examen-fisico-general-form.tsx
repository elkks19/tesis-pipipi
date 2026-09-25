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
import { ActivityIcon, ArrowLeftIcon, ArrowRightIcon, HeartPulseIcon, RulerIcon, SaveIcon } from "lucide-react";
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
import { firstFieldErrors } from "@/lib/schema/field-errors";
import { cn } from "@/lib/utils";

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

const formSteps = [
  { id: "presion", label: "Presión arterial", prefixes: ["presionArterial", "presionArterialMedia"] },
  { id: "signos", label: "Signos vitales", prefixes: ["pulsos", "frecuenciaRespiratoria", "frecuenciaCardiaca", "temperaturaAxilar"] },
  { id: "antropometria", label: "Antropometría", prefixes: ["peso", "talla", "imc", "perimetroCadera", "perimetroCintura", "indiceCinturaCadera", "diagnosticoIMC"] },
] as const;

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
        { label: "Perímetro de cintura", value: textSummary(`${form.perimetroCintura} cm`) },
        { label: "Perímetro de cadera", value: textSummary(`${form.perimetroCadera} cm`) },
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
  const [activeStep, setActiveStep] = useState(0);
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
  const { visibleErrors: allVisibleErrors, onBlurCapture, revealErrors, showWarning } = useInteractiveErrors({
    value: form,
    actionState,
    isPending,
    validationError: validation.success ? undefined : validation.error,
  });
  const visibleErrors = { ...allVisibleErrors };
  if (!form.peso || !form.talla) delete visibleErrors.imc;
  if (!form.perimetroCintura || !form.perimetroCadera) delete visibleErrors.indiceCinturaCadera;
  if (!form.presionArterial.derecha.max || !form.presionArterial.derecha.min ||
      !form.presionArterial.izquierda.max || !form.presionArterial.izquierda.min) {
    delete visibleErrors.presionArterialMedia;
  }

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
    if (activeStep < formSteps.length - 1) {
      event.preventDefault();
      goToStep(activeStep + 1);
      return;
    }

    const nextForm = {
      ...form,
      imc: calculateBmi(form),
      indiceCinturaCadera: calculateWaistHipIndex(form),
      presionArterialMedia: calculateMeanPressure(form),
    };
    if (revealErrors(event)) {
      if (!validation.success) {
        const firstPath = Object.keys(firstFieldErrors(validation.error))[0];
        const errorStep = formSteps.findIndex((step) =>
          step.prefixes.some((prefix) => firstPath === prefix || firstPath.startsWith(`${prefix}.`)),
        );
        if (errorStep >= 0 && errorStep !== activeStep) {
          setActiveStep(errorStep);
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              const control = Array.from(formRef.current?.elements ?? []).find(
                (element) => element.getAttribute("name") === firstPath,
              ) as HTMLElement | undefined;
              control?.focus();
            });
          });
        }
      }
      return;
    }

    setForm(nextForm);

    if (!confirmSubmit(event, getConfirmationSections(nextForm))) {
      return;
    }
  }

  function goToStep(index: number) {
    setActiveStep(index);
    window.requestAnimationFrame(() => {
      document.getElementById(`examen-${formSteps[index].id}-title`)?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
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
      className="grid scroll-mt-20 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6"
      noValidate
      onBlurCapture={onBlurCapture}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <nav aria-label="Pasos del examen físico" className="rounded-xl border bg-muted/20 p-3 lg:sticky lg:top-20">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">En este examen</p>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {formSteps.map((step, index) => {
            const errorCount = Object.keys(visibleErrors).filter((path) =>
              step.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`)),
            ).length;
            return (
              <li className="shrink-0 lg:shrink" key={step.id}>
                <button
                  aria-controls={`examen-${step.id}`}
                  aria-current={activeStep === index ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                    activeStep === index && "bg-accent font-semibold text-accent-foreground",
                    errorCount > 0 && "text-destructive",
                  )}
                  disabled={isPending}
                  onClick={() => goToStep(index)}
                  type="button"
                >
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums text-muted-foreground", activeStep === index && "border-primary bg-primary text-primary-foreground")}>{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{step.label}</span>
                  {errorCount > 0 ? <span aria-label={`${errorCount} errores`} className="text-xs">({errorCount})</span> : null}
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
            <p aria-live="polite">Paso {activeStep + 1} de {formSteps.length} · {formSteps[activeStep].label}</p>
            <p>* Campos obligatorios</p>
          </div>
          <div aria-hidden="true" className="flex gap-1.5">
            {formSteps.map((step, index) => <span className={cn("h-1 flex-1 rounded-full bg-muted", index <= activeStep && "bg-primary")} key={step.id} />)}
          </div>
        </div>
      <FormSection
        description="Registro bilateral de presion arterial y calculo automatico de presion arterial media."
        hidden={activeStep !== 0}
        id="presion"
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
        hidden={activeStep !== 1}
        id="signos"
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
        hidden={activeStep !== 2}
        id="antropometria"
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

      <footer className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ??
            (activeStep === formSteps.length - 1 ? "Revisa las mediciones y guarda el examen." : "Continúa al siguiente apartado cuando termines.")}
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button disabled={isPending || activeStep === 0} onClick={() => goToStep(activeStep - 1)} type="button" variant="outline">
            <ArrowLeftIcon data-icon="inline-start" />Anterior
          </Button>
          {activeStep < formSteps.length - 1 ? (
            <Button disabled={isPending} onClick={() => goToStep(activeStep + 1)} type="button">
              Siguiente<ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : (
            <Button disabled={isPending} type="submit">
              <SaveIcon data-icon="inline-start" />
              {isPending ? "Guardando..." : "Guardar examen"}
            </Button>
          )}
        </div>
      </footer>
      </div>
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
  hidden,
  id,
  title,
}: {
  children: ReactNode;
  description: string;
  hidden?: boolean;
  id: string;
  title: string;
}) {
  const section = title === "Presion arterial"
    ? { number: "01", Icon: ActivityIcon }
    : title === "Signos vitales"
      ? { number: "02", Icon: HeartPulseIcon }
      : { number: "03", Icon: RulerIcon };

  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm" hidden={hidden} id={`examen-${id}`}>
      <div className="flex items-start gap-3 border-b bg-muted/20 p-4 sm:p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
          <section.Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Apartado {section.number}</span>
          <h2 className="text-base font-semibold" id={`examen-${id}-title`} tabIndex={-1}>{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
