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

import {
  CheckboxListField,
  Field,
  TextareaField,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function createInitialValue(defaultValue?: Partial<EspirometriaFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
    observaciones: defaultValue?.observaciones ?? [],
  };
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
    const result = CreateEspirometriaSchema.safeParse(buildPayload(form));

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
        description="Volumenes y porcentajes teoricos principales de la maniobra."
        title="Volumenes"
      >
        <FieldGrid>
          <NumberField
            error={visibleErrors.FEV1}
            label="FEV1"
            name="FEV1"
            onChange={(value) =>
              setForm((current) => ({ ...current, FEV1: value }))
            }
            step="0.01"
            value={form.FEV1}
          />
          <NumberField
            error={visibleErrors.porcentajeFEVteorico}
            label="% FEV teorico"
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
            label="FVC"
            name="FVC"
            onChange={(value) =>
              setForm((current) => ({ ...current, FVC: value }))
            }
            step="0.01"
            value={form.FVC}
          />
          <NumberField
            error={visibleErrors.porcentajeFVCteorico}
            label="% FVC teorico"
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
        description="Relacion FEV1/FVC, flujo pico y fuente de valores teoricos."
        title="Flujos"
      >
        <FieldGrid>
          <NumberField
            error={visibleErrors.FEV1FVC}
            label="FEV1/FVC"
            name="FEV1FVC"
            onChange={(value) =>
              setForm((current) => ({ ...current, FEV1FVC: value }))
            }
            step="0.01"
            value={form.FEV1FVC}
          />
          <NumberField
            error={visibleErrors.porcentajeFEV1FVCteorico}
            label="% FEV1/FVC teorico"
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
            label="PEF"
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
            label="% PEF teorico"
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
            label="Fuente datos teoricos"
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
        description="Calidad de maniobra y diagnostico final de la estacion."
        title="Interpretacion"
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
          {actionState.message ?? "Completa la espirometria para guardar."}
        </p>
        <Button disabled={isPending} type="submit">
          <SaveIcon data-icon="inline-start" />
          {isPending ? "Guardando..." : "Guardar espirometria"}
        </Button>
      </footer>
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
    <Field error={error}>
      <Label htmlFor={name}>{label}</Label>
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
