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
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { Field, TextareaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateElectrocardiogramaSchema } from "@/lib/schema/electrocardiograma";

export type ElectrocardiogramaFormValue = {
  crecimientoAuriculaDerecha: boolean;
  crecimientoAuriculaIzquierda: boolean;
  crecimientoVentriculoDerecho: boolean;
  crecimientoVentriculoIzquierdo: boolean;
  derivacionSupraInfraDesnivelST: string;
  diagnostico: string;
  duracionComplejoQRS: string;
  duracionOndaP: string;
  duracionOndaT: string;
  extrasistoleIntraventricular: boolean;
  extrasistoleSupraventricular: boolean;
  frecuenciaCardiaca: string;
  intervaloPR: string;
  intervaloQTc: string;
  ritmo: string;
  supraInfraDesnivelST: boolean;
};

type ElectrocardiogramaActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type ElectrocardiogramaAction = (
  previousState: ElectrocardiogramaActionState,
  formData: FormData,
) => Promise<ElectrocardiogramaActionState>;

type ElectrocardiogramaFormProps = {
  action?: ElectrocardiogramaAction;
  defaultValue?: Partial<ElectrocardiogramaFormValue>;
  successRedirectHref?: string;
};

const baseFormValue: ElectrocardiogramaFormValue = {
  crecimientoAuriculaDerecha: false,
  crecimientoAuriculaIzquierda: false,
  crecimientoVentriculoDerecho: false,
  crecimientoVentriculoIzquierdo: false,
  derivacionSupraInfraDesnivelST: "",
  diagnostico: "",
  duracionComplejoQRS: "",
  duracionOndaP: "",
  duracionOndaT: "",
  extrasistoleIntraventricular: false,
  extrasistoleSupraventricular: false,
  frecuenciaCardiaca: "",
  intervaloPR: "",
  intervaloQTc: "",
  ritmo: "",
  supraInfraDesnivelST: false,
};

async function noopAction(): Promise<ElectrocardiogramaActionState> {
  return { ok: false };
}

function toNumber(value: string) {
  return value.trim().length > 0 ? Number(value) : Number.NaN;
}

function buildPayload(state: ElectrocardiogramaFormValue) {
  return {
    ritmo: state.ritmo.trim(),
    frecuenciaCardiaca: toNumber(state.frecuenciaCardiaca),
    crecimientoAuriculaDerecha: state.crecimientoAuriculaDerecha,
    crecimientoAuriculaIzquierda: state.crecimientoAuriculaIzquierda,
    crecimientoVentriculoDerecho: state.crecimientoVentriculoDerecho,
    crecimientoVentriculoIzquierdo: state.crecimientoVentriculoIzquierdo,
    intervaloPR: toNumber(state.intervaloPR),
    intervaloQTc: toNumber(state.intervaloQTc),
    supraInfraDesnivelST: state.supraInfraDesnivelST,
    derivacionSupraInfraDesnivelST:
      state.derivacionSupraInfraDesnivelST.trim(),
    duracionOndaP: toNumber(state.duracionOndaP),
    duracionComplejoQRS: toNumber(state.duracionComplejoQRS),
    duracionOndaT: toNumber(state.duracionOndaT),
    extrasistoleSupraventricular: state.extrasistoleSupraventricular,
    extrasistoleIntraventricular: state.extrasistoleIntraventricular,
    diagnostico: state.diagnostico.trim(),
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

function createInitialValue(defaultValue?: Partial<ElectrocardiogramaFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
  };
}

export function ElectrocardiogramaForm({
  action,
  defaultValue,
  successRedirectHref,
}: ElectrocardiogramaFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] =
    useState<ElectrocardiogramaFormValue>(initialValue);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const result = CreateElectrocardiogramaSchema.safeParse(
      buildPayload(form),
    );

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
    <form
      action={formAction}
      className="flex flex-col gap-6"
      onSubmit={handleSubmit}
    >
      <FormSection
        description="Ritmo basal, frecuencia cardiaca e intervalos principales."
        title="Lectura general"
      >
        <FieldGrid>
          <TextField
            error={visibleErrors.ritmo}
            label="Ritmo"
            name="ritmo"
            onChange={(value) =>
              setForm((current) => ({ ...current, ritmo: value }))
            }
            required
            value={form.ritmo}
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
            error={visibleErrors.intervaloPR}
            label="Intervalo PR"
            name="intervaloPR"
            onChange={(value) =>
              setForm((current) => ({ ...current, intervaloPR: value }))
            }
            suffix="ms"
            value={form.intervaloPR}
          />
          <NumberField
            error={visibleErrors.intervaloQTc}
            label="Intervalo QTc"
            name="intervaloQTc"
            onChange={(value) =>
              setForm((current) => ({ ...current, intervaloQTc: value }))
            }
            suffix="ms"
            value={form.intervaloQTc}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        description="Crecimientos de cavidades y alteraciones del segmento ST."
        title="Hallazgos estructurales"
      >
        <FieldGrid>
          <CheckboxField
            checked={form.crecimientoAuriculaDerecha}
            label="Crecimiento auricula derecha"
            name="crecimientoAuriculaDerecha"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                crecimientoAuriculaDerecha: checked,
              }))
            }
          />
          <CheckboxField
            checked={form.crecimientoAuriculaIzquierda}
            label="Crecimiento auricula izquierda"
            name="crecimientoAuriculaIzquierda"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                crecimientoAuriculaIzquierda: checked,
              }))
            }
          />
          <CheckboxField
            checked={form.crecimientoVentriculoDerecho}
            label="Crecimiento ventriculo derecho"
            name="crecimientoVentriculoDerecho"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                crecimientoVentriculoDerecho: checked,
              }))
            }
          />
          <CheckboxField
            checked={form.crecimientoVentriculoIzquierdo}
            label="Crecimiento ventriculo izquierdo"
            name="crecimientoVentriculoIzquierdo"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                crecimientoVentriculoIzquierdo: checked,
              }))
            }
          />
          <CheckboxField
            checked={form.supraInfraDesnivelST}
            label="Supra/infra desnivel ST"
            name="supraInfraDesnivelST"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                supraInfraDesnivelST: checked,
              }))
            }
          />
          <TextField
            error={visibleErrors.derivacionSupraInfraDesnivelST}
            label="Derivacion del desnivel ST"
            name="derivacionSupraInfraDesnivelST"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                derivacionSupraInfraDesnivelST: value,
              }))
            }
            required
            value={form.derivacionSupraInfraDesnivelST}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        description="Duracion de ondas y presencia de extrasistoles."
        title="Ondas y complejos"
      >
        <FieldGrid>
          <NumberField
            error={visibleErrors.duracionOndaP}
            label="Duracion onda P"
            name="duracionOndaP"
            onChange={(value) =>
              setForm((current) => ({ ...current, duracionOndaP: value }))
            }
            suffix="ms"
            value={form.duracionOndaP}
          />
          <NumberField
            error={visibleErrors.duracionComplejoQRS}
            label="Duracion complejo QRS"
            name="duracionComplejoQRS"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                duracionComplejoQRS: value,
              }))
            }
            suffix="ms"
            value={form.duracionComplejoQRS}
          />
          <NumberField
            error={visibleErrors.duracionOndaT}
            label="Duracion onda T"
            name="duracionOndaT"
            onChange={(value) =>
              setForm((current) => ({ ...current, duracionOndaT: value }))
            }
            suffix="ms"
            value={form.duracionOndaT}
          />
          <CheckboxField
            checked={form.extrasistoleSupraventricular}
            label="Extrasistole supraventricular"
            name="extrasistoleSupraventricular"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                extrasistoleSupraventricular: checked,
              }))
            }
          />
          <CheckboxField
            checked={form.extrasistoleIntraventricular}
            label="Extrasistole intraventricular"
            name="extrasistoleIntraventricular"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                extrasistoleIntraventricular: checked,
              }))
            }
          />
        </FieldGrid>
        <TextareaField
          error={visibleErrors.diagnostico}
          label="Diagnostico"
          name="diagnostico"
          onChange={(value) =>
            setForm((current) => ({ ...current, diagnostico: value }))
          }
          required
          value={form.diagnostico}
        />
      </FormSection>

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-3xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? "Completa la lectura para guardar."}
        </p>
        <Button disabled={isPending} type="submit">
          <SaveIcon data-icon="inline-start" />
          {isPending ? "Guardando..." : "Guardar electrocardiograma"}
        </Button>
      </footer>
    </form>
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
    <div className="flex min-h-10 items-center gap-2 rounded-2xl border bg-background px-3 py-2">
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

function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
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

function NumberField({
  error,
  label,
  name,
  onChange,
  step = "1",
  suffix,
  value,
}: {
  error?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  step?: string;
  suffix?: string;
  value: string;
}) {
  return (
    <Field error={error}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={name}>{label}</Label>
        {suffix ? (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
      <Input
        aria-invalid={Boolean(error)}
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
