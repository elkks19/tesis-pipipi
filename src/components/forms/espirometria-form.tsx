"use client";

import {
  type FormEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, ActivityIcon, GaugeIcon, SaveIcon, WindIcon } from "lucide-react";
import { toast } from "sonner";

import {
  CheckboxListField,
  Field,
  TextareaField,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { firstFieldErrors } from "@/lib/schema/field-errors";
import {
  listSummary,
  textSummary,
  useSubmitConfirmation,
} from "@/components/forms/submit-confirmation";
import {
  CreateEspirometriaSchema,
  tiposObservaciones,
} from "@/lib/schema/espirometria";

export type EspirometriaFormValue = {
  FEV1: string;
  FEV1FVC: string;
  FVC: string;
  diagnostico: string;
  flujoEspiratorioPicoPEF: string;
  fuenteDatosTeoricos: string;
  observaciones: (typeof tiposObservaciones)[number][];
  porcentajeFEV1FVCteorico: string;
  porcentajeFEVteorico: string;
  porcentajeFVCteorico: string;
  porcentajePEFteorico: string;
};

type EspirometriaActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type EspirometriaAction = (
  previousState: EspirometriaActionState,
  formData: FormData,
) => Promise<EspirometriaActionState>;

type EspirometriaFormProps = {
  action?: EspirometriaAction;
  defaultValue?: Partial<EspirometriaFormValue>;
  successRedirectHref?: string;
};

const baseFormValue: EspirometriaFormValue = {
  FEV1: "",
  FEV1FVC: "",
  FVC: "",
  diagnostico: "",
  flujoEspiratorioPicoPEF: "",
  fuenteDatosTeoricos: "",
  observaciones: [],
  porcentajeFEV1FVCteorico: "",
  porcentajeFEVteorico: "",
  porcentajeFVCteorico: "",
  porcentajePEFteorico: "",
};

const formSteps = [
  { id: "volumenes", label: "Volúmenes", prefixes: ["FEV1", "porcentajeFEVteorico", "FVC", "porcentajeFVCteorico"] },
  { id: "flujos", label: "Flujos", prefixes: ["FEV1FVC", "porcentajeFEV1FVCteorico", "flujoEspiratorioPicoPEF", "porcentajePEFteorico", "fuenteDatosTeoricos"] },
  { id: "interpretacion", label: "Interpretación", prefixes: ["observaciones", "diagnostico"] },
] as const;

async function noopAction(): Promise<EspirometriaActionState> {
  return { ok: false };
}

function toNumber(value: string) {
  return value.trim().length > 0 ? Number(value) : Number.NaN;
}

function buildPayload(state: EspirometriaFormValue) {
  return {
    FEV1: toNumber(state.FEV1),
    porcentajeFEVteorico: toNumber(state.porcentajeFEVteorico),
    FVC: toNumber(state.FVC),
    porcentajeFVCteorico: toNumber(state.porcentajeFVCteorico),
    FEV1FVC: toNumber(state.FEV1FVC),
    porcentajeFEV1FVCteorico: toNumber(state.porcentajeFEV1FVCteorico),
    flujoEspiratorioPicoPEF: toNumber(state.flujoEspiratorioPicoPEF),
    porcentajePEFteorico: toNumber(state.porcentajePEFteorico),
    fuenteDatosTeoricos: state.fuenteDatosTeoricos.trim() || undefined,
    observaciones: state.observaciones,
    diagnostico: state.diagnostico.trim(),
  };
}

function createInitialValue(defaultValue?: Partial<EspirometriaFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
    observaciones: defaultValue?.observaciones ?? [],
  };
}

function getConfirmationSections(form: EspirometriaFormValue) {
  return [
    {
      title: "Volúmenes",
      items: [
        {
          label: "FEV1",
          value: textSummary(`${form.FEV1} (${form.porcentajeFEVteorico}%)`),
        },
        {
          label: "FVC",
          value: textSummary(`${form.FVC} (${form.porcentajeFVCteorico}%)`),
        },
        {
          label: "FEV1/FVC",
          value: textSummary(
            `${form.FEV1FVC} (${form.porcentajeFEV1FVCteorico}%)`,
          ),
        },
        {
          label: "PEF",
          value: textSummary(
            `${form.flujoEspiratorioPicoPEF} (${form.porcentajePEFteorico}%)`,
          ),
        },
      ],
    },
    {
      title: "Interpretación",
      items: [
        { label: "Fuente teórica", value: textSummary(form.fuenteDatosTeoricos) },
        { label: "Observaciones", value: listSummary(form.observaciones) },
        { label: "Diagnóstico", value: textSummary(form.diagnostico) },
      ],
    },
  ];
}

export function EspirometriaForm({
  action,
  defaultValue,
  successRedirectHref,
}: EspirometriaFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<EspirometriaFormValue>(initialValue);
  const [activeStep, setActiveStep] = useState(0);
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: "Guardar espirometría",
    });
  const validation = CreateEspirometriaSchema.safeParse(buildPayload(form));
  const { visibleErrors, onBlurCapture, revealErrors } = useInteractiveErrors({
    value: form, actionState, isPending,
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
    if (activeStep < formSteps.length - 1) {
      event.preventDefault();
      goToStep(activeStep + 1);
      return;
    }

    if (revealErrors(event)) {
      const firstPath = !validation.success
        ? Object.keys(firstFieldErrors(validation.error))[0]
        : Object.keys(actionState.errors ?? {})[0];
      const errorStep = formSteps.findIndex((step) =>
        step.prefixes.some((prefix) => firstPath === prefix || firstPath?.startsWith(`${prefix}.`)),
      );
      if (errorStep >= 0 && errorStep !== activeStep) {
        setActiveStep(errorStep);
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          const control = Array.from(formRef.current?.elements ?? []).find(
            (element) => element.getAttribute("name") === firstPath,
          ) as HTMLElement | undefined;
          control?.focus();
        }));
      }
      return;
    }

    if (!confirmSubmit(event, getConfirmationSections(form))) {
      return;
    }
  }

  function goToStep(index: number) {
    setActiveStep(index);
    window.requestAnimationFrame(() => {
      document.getElementById(`espirometria-${formSteps[index].id}-title`)?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
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
      <nav aria-label="Pasos de la espirometría" className="rounded-xl border bg-muted/20 p-3 lg:sticky lg:top-20">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">En este estudio</p>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {formSteps.map((step, index) => {
            const errorCount = Object.keys(visibleErrors).filter((path) =>
              step.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`)),
            ).length;
            return (
              <li className="shrink-0 lg:shrink" key={step.id}>
                <button
                  aria-controls={`espirometria-${step.id}`}
                  aria-current={activeStep === index ? "step" : undefined}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50", activeStep === index && "bg-accent font-semibold text-accent-foreground", errorCount > 0 && "text-destructive")}
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
        <p className="hidden px-2 pt-4 text-xs leading-relaxed text-muted-foreground lg:block">Puedes cambiar de apartado sin perder lo escrito. Guarda al finalizar.</p>
      </nav>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p aria-live="polite">Paso {activeStep + 1} de {formSteps.length} · {formSteps[activeStep].label}</p><p>* Campos obligatorios</p></div>
          <div aria-hidden="true" className="flex gap-1.5">{formSteps.map((step, index) => <span className={cn("h-1 flex-1 rounded-full bg-muted", index <= activeStep && "bg-primary")} key={step.id} />)}</div>
        </div>
      <FormSection
        description="Volúmenes medidos y porcentajes de referencia de la maniobra."
        hidden={activeStep !== 0}
        id="volumenes"
        title="Volúmenes"
      >
        <FieldGrid>
          <NumberField
            error={visibleErrors.FEV1}
            label="FEV1 · volumen espirado en el primer segundo (L)"
            name="FEV1"
            onChange={(value) =>
              setForm((current) => ({ ...current, FEV1: value }))
            }
            step="0.01"
            value={form.FEV1}
          />
          <NumberField
            error={visibleErrors.porcentajeFEVteorico}
            label="FEV1 respecto al valor teórico (%)"
            name="porcentajeFEVteorico"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                porcentajeFEVteorico: value,
              }))
            }
            value={form.porcentajeFEVteorico}
          />
          <NumberField
            error={visibleErrors.FVC}
            label="FVC · capacidad vital forzada (L)"
            name="FVC"
            onChange={(value) =>
              setForm((current) => ({ ...current, FVC: value }))
            }
            step="0.01"
            value={form.FVC}
          />
          <NumberField
            error={visibleErrors.porcentajeFVCteorico}
            label="FVC respecto al valor teórico (%)"
            name="porcentajeFVCteorico"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                porcentajeFVCteorico: value,
              }))
            }
            value={form.porcentajeFVCteorico}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        description="Relación FEV1/FVC, flujo pico y fuente de los valores teóricos."
        hidden={activeStep !== 1}
        id="flujos"
        title="Flujos"
      >
        <FieldGrid>
          <NumberField
            error={visibleErrors.FEV1FVC}
            label="Relación FEV1/FVC (%)"
            name="FEV1FVC"
            onChange={(value) =>
              setForm((current) => ({ ...current, FEV1FVC: value }))
            }
            step="0.01"
            value={form.FEV1FVC}
          />
          <NumberField
            error={visibleErrors.porcentajeFEV1FVCteorico}
            label="FEV1/FVC respecto al valor teórico (%)"
            name="porcentajeFEV1FVCteorico"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                porcentajeFEV1FVCteorico: value,
              }))
            }
            value={form.porcentajeFEV1FVCteorico}
          />
          <NumberField
            error={visibleErrors.flujoEspiratorioPicoPEF}
            label="PEF · flujo espiratorio pico (L/min)"
            name="flujoEspiratorioPicoPEF"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                flujoEspiratorioPicoPEF: value,
              }))
            }
            step="0.01"
            value={form.flujoEspiratorioPicoPEF}
          />
          <NumberField
            error={visibleErrors.porcentajePEFteorico}
            label="PEF respecto al valor teórico (%)"
            name="porcentajePEFteorico"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                porcentajePEFteorico: value,
              }))
            }
            value={form.porcentajePEFteorico}
          />
          <TextField
            error={visibleErrors.fuenteDatosTeoricos}
            label="Fuente de los valores teóricos"
            name="fuenteDatosTeoricos"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                fuenteDatosTeoricos: value,
              }))
            }
            value={form.fuenteDatosTeoricos}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        description="Calidad de la maniobra y diagnóstico final del estudio."
        hidden={activeStep !== 2}
        id="interpretacion"
        title="Interpretación"
      >
        <CheckboxListField
          label="Observaciones"
          name="observaciones"
          onChange={(value) =>
            setForm((current) => ({ ...current, observaciones: value }))
          }
          options={tiposObservaciones}
          value={form.observaciones}
        />
        <TextareaField
          error={visibleErrors.diagnostico}
          label="Diagnóstico"
          name="diagnostico"
          onChange={(value) =>
            setForm((current) => ({ ...current, diagnostico: value }))
          }
          required
          value={form.diagnostico}
        />
      </FormSection>

      <footer className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? (activeStep === formSteps.length - 1 ? "Revisa los resultados y guarda la espirometría." : "Continúa al siguiente apartado cuando termines.")}
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button disabled={isPending || activeStep === 0} onClick={() => goToStep(activeStep - 1)} type="button" variant="outline"><ArrowLeftIcon data-icon="inline-start" />Anterior</Button>
          {activeStep < formSteps.length - 1 ? (
            <Button disabled={isPending} onClick={() => goToStep(activeStep + 1)} type="button">Siguiente<ArrowRightIcon data-icon="inline-end" /></Button>
          ) : (
            <Button disabled={isPending} type="submit"><SaveIcon data-icon="inline-start" />{isPending ? "Guardando..." : "Guardar espirometría"}</Button>
          )}
        </div>
      </footer>
      </div>
      {confirmationDialog}
    </form>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
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
  const index = formSteps.findIndex((step) => step.id === id);
  const Icon = id === "volumenes" ? WindIcon : id === "flujos" ? GaugeIcon : ActivityIcon;
  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm" hidden={hidden} id={`espirometria-${id}`}>
      <div className="flex items-start gap-3 border-b bg-muted/20 p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Apartado {String(index + 1).padStart(2, "0")}</p>
          <h2 className="text-base font-semibold" id={`espirometria-${id}-title`} tabIndex={-1}>{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-5 p-4 sm:p-6">{children}</div>
    </section>
  );
}

function NumberField({
  error,
  label,
  name,
  onChange,
  step = "1",
  value,
}: {
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
}) {
  return (
    <Field error={error} name={name}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        id={name}
        min={0}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required
        step={step}
        type="number"
        value={value}
      />
    </Field>
  );
}
