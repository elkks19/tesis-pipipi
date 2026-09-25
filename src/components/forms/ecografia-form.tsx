"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImageIcon,
  ScanSearchIcon,
  SaveIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Field,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { firstFieldErrors } from "@/lib/schema/field-errors";
import {
  booleanSummary,
  textSummary,
  useSubmitConfirmation,
} from "@/components/forms/submit-confirmation";
import {
  CreateEcografiaSchema,
  tiposEcogenicidad,
  tiposParedes,
  tiposParenquima,
} from "@/lib/schema/ecografia";

type Emptyable<T extends string> = T | "";

export type EcografiaFormValue = {
  historiaId: string;
  higado: {
    dimensiones: string;
    hepatomegalia: boolean;
    parenquima: Emptyable<(typeof tiposParenquima)[number]>;
    diagnostico: string;
  };
  vesiculaBiliar: {
    paredes: Emptyable<(typeof tiposParedes)[number]>;
    contenidoAnecoico: boolean;
    barroBiliar: boolean;
    calculos: boolean;
    diagnostico: string;
  };
  riñones: {
    derecho: {
      longitud: string;
      parenquima: string;
    };
    izquierdo: {
      longitud: string;
      parenquima: string;
    };
    ecogenicidad: Emptyable<(typeof tiposEcogenicidad)[number]>;
    relacionCorticoMedular: Emptyable<(typeof tiposEcogenicidad)[number]>;
    diagnostico: string;
  };
};

type EcografiaActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type EcografiaAction = (
  previousState: EcografiaActionState,
  formData: FormData,
) => Promise<EcografiaActionState>;

type EcografiaFormProps = {
  action?: EcografiaAction;
  defaultValue?: Partial<EcografiaFormValue>;
  imagenPreview?: string;
  successRedirectHref?: string;
};

const baseFormValue: EcografiaFormValue = {
  historiaId: "",
  higado: {
    dimensiones: "",
    hepatomegalia: false,
    parenquima: "",
    diagnostico: "",
  },
  vesiculaBiliar: {
    paredes: "",
    contenidoAnecoico: false,
    barroBiliar: false,
    calculos: false,
    diagnostico: "",
  },
  riñones: {
    derecho: {
      longitud: "",
      parenquima: "",
    },
    izquierdo: {
      longitud: "",
      parenquima: "",
    },
    ecogenicidad: "",
    relacionCorticoMedular: "",
    diagnostico: "",
  },
};

const formSteps = [
  { id: "higado", label: "Hígado", prefixes: ["higado"] },
  { id: "vesicula", label: "Vesícula biliar", prefixes: ["vesiculaBiliar"] },
  { id: "rinones", label: "Riñones", prefixes: ["riñones"] },
  { id: "imagen", label: "Imagen del estudio", prefixes: ["imagen"] },
] as const;

async function noopAction(): Promise<EcografiaActionState> {
  return { ok: false };
}

function requiredNumber(value: string) {
  return value.trim().length > 0 ? Number(value) : Number.NaN;
}

function buildPayload(state: EcografiaFormValue) {
  return {
    historiaId: state.historiaId,
    higado: {
      dimensiones: requiredNumber(state.higado.dimensiones),
      hepatomegalia: state.higado.hepatomegalia,
      parenquima: state.higado.parenquima,
      diagnostico: state.higado.diagnostico.trim(),
    },
    vesiculaBiliar: {
      paredes: state.vesiculaBiliar.paredes,
      contenidoAnecoico: state.vesiculaBiliar.contenidoAnecoico,
      barroBiliar: state.vesiculaBiliar.barroBiliar,
      calculos: state.vesiculaBiliar.calculos,
      diagnostico: state.vesiculaBiliar.diagnostico.trim(),
    },
    riñones: {
      derecho: {
        longitud: requiredNumber(state.riñones.derecho.longitud),
        parenquima: requiredNumber(state.riñones.derecho.parenquima),
      },
      izquierdo: {
        longitud: requiredNumber(state.riñones.izquierdo.longitud),
        parenquima: requiredNumber(state.riñones.izquierdo.parenquima),
      },
      ecogenicidad: state.riñones.ecogenicidad,
      relacionCorticoMedular: state.riñones.relacionCorticoMedular,
      diagnostico: state.riñones.diagnostico.trim(),
    },
  };
}

function createInitialValue(defaultValue?: Partial<EcografiaFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
    higado: {
      ...baseFormValue.higado,
      ...defaultValue?.higado,
    },
    vesiculaBiliar: {
      ...baseFormValue.vesiculaBiliar,
      ...defaultValue?.vesiculaBiliar,
    },
    riñones: {
      ...baseFormValue.riñones,
      ...defaultValue?.riñones,
      derecho: {
        ...baseFormValue.riñones.derecho,
        ...defaultValue?.riñones?.derecho,
      },
      izquierdo: {
        ...baseFormValue.riñones.izquierdo,
        ...defaultValue?.riñones?.izquierdo,
      },
    },
  };
}

function getConfirmationSections(
  form: EcografiaFormValue,
  imageName: string,
) {
  return [
    {
      title: "Hígado",
      items: [
        { label: "Dimensiones", value: textSummary(`${form.higado.dimensiones} cm`) },
        { label: "Parénquima", value: textSummary(form.higado.parenquima) },
        { label: "Hepatomegalia", value: booleanSummary(form.higado.hepatomegalia) },
        { label: "Diagnóstico", value: textSummary(form.higado.diagnostico) },
      ],
    },
    {
      title: "Vesícula biliar",
      items: [
        { label: "Paredes", value: textSummary(form.vesiculaBiliar.paredes) },
        {
          label: "Contenido anecoico",
          value: booleanSummary(form.vesiculaBiliar.contenidoAnecoico),
        },
        { label: "Barro biliar", value: booleanSummary(form.vesiculaBiliar.barroBiliar) },
        { label: "Cálculos", value: booleanSummary(form.vesiculaBiliar.calculos) },
        { label: "Diagnóstico", value: textSummary(form.vesiculaBiliar.diagnostico) },
      ],
    },
    {
      title: "Riñones",
      items: [
        {
          label: "Derecho",
          value: textSummary(
            `${form.riñones.derecho.longitud} cm / parénquima ${form.riñones.derecho.parenquima} cm`,
          ),
        },
        {
          label: "Izquierdo",
          value: textSummary(
            `${form.riñones.izquierdo.longitud} cm / parénquima ${form.riñones.izquierdo.parenquima} cm`,
          ),
        },
        { label: "Ecogenicidad", value: textSummary(form.riñones.ecogenicidad) },
        {
          label: "Relación cortico-medular",
          value: textSummary(form.riñones.relacionCorticoMedular),
        },
        { label: "Diagnóstico", value: textSummary(form.riñones.diagnostico) },
      ],
    },
    { title: "Imagen del estudio", items: [{ label: "Fotografía", value: textSummary(imageName) }] },
  ];
}

export function EcografiaForm({
  action,
  defaultValue,
  imagenPreview,
  successRedirectHref,
}: EcografiaFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<EcografiaFormValue>(initialValue);
  const [preview, setPreview] = useState(imagenPreview ?? "");
  const [activeStep, setActiveStep] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: "Guardar ecografía",
    });
  const validation = CreateEcografiaSchema.omit({ imagen: true }).safeParse(buildPayload(form));
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

    const selectedImage = inputRef.current?.files?.item(0)?.name;
    const imageName = selectedImage ?? (preview ? "Imagen registrada" : "");

    if (!confirmSubmit(event, getConfirmationSections(form, imageName))) {
      return;
    }
  }

  function goToStep(index: number) {
    setActiveStep(index);
    window.requestAnimationFrame(() => {
      document.getElementById(`ecografia-${formSteps[index].id}-title`)?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function updateImage(file?: File) {
    if (!file) {
      setPreview(imagenPreview ?? "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen valida.");
      return;
    }

    setPreview(URL.createObjectURL(file));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    updateImage(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files.item(0);

    if (!file || !inputRef.current) {
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    inputRef.current.files = dataTransfer.files;
    updateImage(file);
  }

  function clearImage() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setPreview("");
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
      <Input name="historiaId" type="hidden" value={form.historiaId} />

      <nav aria-label="Pasos de la ecografía" className="rounded-xl border bg-muted/20 p-3 lg:sticky lg:top-20">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">En este estudio</p>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {formSteps.map((step, index) => {
            const errorCount = Object.keys(visibleErrors).filter((path) =>
              step.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`)),
            ).length;
            return (
              <li className="shrink-0 lg:shrink" key={step.id}>
                <button
                  aria-controls={`ecografia-${step.id}`}
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
        <p className="hidden px-2 pt-4 text-xs leading-relaxed text-muted-foreground lg:block">Puedes cambiar de apartado sin perder lo escrito. Guarda al finalizar.</p>
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
        description="Medidas y hallazgos principales del hígado."
        hidden={activeStep !== 0}
        id="higado"
        title="Hígado"
      >
        <FieldGrid>
          <TextField
            error={visibleErrors["higado.dimensiones"]}
            label="Dimensiones"
            min={0}
            name="higado.dimensiones"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                higado: { ...current.higado, dimensiones: value },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.higado.dimensiones}
          />
          <SelectField
            error={visibleErrors["higado.parenquima"]}
            label="Parenquima"
            name="higado.parenquima"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                higado: { ...current.higado, parenquima: value },
              }))
            }
            options={tiposParenquima}
            required
            value={form.higado.parenquima}
          />
          <CheckboxField
            checked={form.higado.hepatomegalia}
            label="Hepatomegalia"
            name="higado.hepatomegalia"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                higado: { ...current.higado, hepatomegalia: checked },
              }))
            }
          />
        </FieldGrid>
        <TextareaField
          error={visibleErrors["higado.diagnostico"]}
          label="Diagnostico"
          name="higado.diagnostico"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              higado: { ...current.higado, diagnostico: value },
            }))
          }
          required
          value={form.higado.diagnostico}
        />
      </FormSection>

      <FormSection
        description="Describe las paredes, el contenido y el diagnóstico vesicular."
        hidden={activeStep !== 1}
        id="vesicula"
        title="Vesícula biliar"
      >
        <FieldGrid>
          <SelectField
            error={visibleErrors["vesiculaBiliar.paredes"]}
            label="Paredes"
            name="vesiculaBiliar.paredes"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                vesiculaBiliar: {
                  ...current.vesiculaBiliar,
                  paredes: value,
                },
              }))
            }
            options={tiposParedes}
            required
            value={form.vesiculaBiliar.paredes}
          />
          <CheckboxField
            checked={form.vesiculaBiliar.contenidoAnecoico}
            label="Contenido anecoico"
            name="vesiculaBiliar.contenidoAnecoico"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                vesiculaBiliar: {
                  ...current.vesiculaBiliar,
                  contenidoAnecoico: checked,
                },
              }))
            }
          />
          <CheckboxField
            checked={form.vesiculaBiliar.barroBiliar}
            label="Barro biliar"
            name="vesiculaBiliar.barroBiliar"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                vesiculaBiliar: {
                  ...current.vesiculaBiliar,
                  barroBiliar: checked,
                },
              }))
            }
          />
          <CheckboxField
            checked={form.vesiculaBiliar.calculos}
            label="Calculos"
            name="vesiculaBiliar.calculos"
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                vesiculaBiliar: {
                  ...current.vesiculaBiliar,
                  calculos: checked,
                },
              }))
            }
          />
        </FieldGrid>
        <TextareaField
          error={visibleErrors["vesiculaBiliar.diagnostico"]}
          label="Diagnostico"
          name="vesiculaBiliar.diagnostico"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              vesiculaBiliar: {
                ...current.vesiculaBiliar,
                diagnostico: value,
              },
            }))
          }
          required
          value={form.vesiculaBiliar.diagnostico}
        />
      </FormSection>

      <FormSection
        description="Mediciones renales y hallazgos ecográficos comparativos."
        hidden={activeStep !== 2}
        id="rinones"
        title="Riñones"
      >
        <FieldGrid>
          <TextField
            error={visibleErrors["riñones.derecho.longitud"]}
            label="Riñón derecho longitud"
            min={0}
            name="riñones.derecho.longitud"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riñones: {
                  ...current.riñones,
                  derecho: { ...current.riñones.derecho, longitud: value },
                },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.riñones.derecho.longitud}
          />
          <TextField
            error={visibleErrors["riñones.derecho.parenquima"]}
            label="Riñón derecho parenquima"
            min={0}
            name="riñones.derecho.parenquima"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riñones: {
                  ...current.riñones,
                  derecho: { ...current.riñones.derecho, parenquima: value },
                },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.riñones.derecho.parenquima}
          />
          <TextField
            error={visibleErrors["riñones.izquierdo.longitud"]}
            label="Riñón izquierdo longitud"
            min={0}
            name="riñones.izquierdo.longitud"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riñones: {
                  ...current.riñones,
                  izquierdo: {
                    ...current.riñones.izquierdo,
                    longitud: value,
                  },
                },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.riñones.izquierdo.longitud}
          />
          <TextField
            error={visibleErrors["riñones.izquierdo.parenquima"]}
            label="Riñón izquierdo parenquima"
            min={0}
            name="riñones.izquierdo.parenquima"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riñones: {
                  ...current.riñones,
                  izquierdo: {
                    ...current.riñones.izquierdo,
                    parenquima: value,
                  },
                },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.riñones.izquierdo.parenquima}
          />
          <SelectField
            error={visibleErrors["riñones.ecogenicidad"]}
            label="Ecogenicidad"
            name="riñones.ecogenicidad"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riñones: { ...current.riñones, ecogenicidad: value },
              }))
            }
            options={tiposEcogenicidad}
            required
            value={form.riñones.ecogenicidad}
          />
          <SelectField
            error={visibleErrors["riñones.relacionCorticoMedular"]}
            label="Relacion cortico-medular"
            name="riñones.relacionCorticoMedular"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riñones: {
                  ...current.riñones,
                  relacionCorticoMedular: value,
                },
              }))
            }
            options={tiposEcogenicidad}
            required
            value={form.riñones.relacionCorticoMedular}
          />
        </FieldGrid>
        <TextareaField
          error={visibleErrors["riñones.diagnostico"]}
          label="Diagnostico"
          name="riñones.diagnostico"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              riñones: { ...current.riñones, diagnostico: value },
            }))
          }
          required
          value={form.riñones.diagnostico}
        />
      </FormSection>

      <FormSection
        description="Adjunta una fotografía representativa del estudio realizado."
        hidden={activeStep !== 3}
        id="imagen"
        title="Imagen del estudio"
      >
        <Field error={visibleErrors.imagen}>
          <Label htmlFor="imagen">Foto de la ecografia</Label>
          <div
            className={cn("flex flex-col gap-4 rounded-xl border border-dashed bg-muted/20 p-4 transition-colors", isDragging && "border-primary bg-primary/5")}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDrop={handleDrop}
            data-dragging={isDragging}
          >
            {preview ? (
              <div className="overflow-hidden rounded-lg border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Vista previa de ecografía"
                  className="max-h-80 w-full object-contain"
                  src={preview}
                />
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg bg-background px-6 py-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><ImageIcon className="size-6" /></span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    Arrastra una imagen o selecciónala
                  </p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Verás una vista previa antes de guardar el registro.
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => inputRef.current?.click()}
                type="button"
                variant="outline"
              >
                <UploadCloudIcon data-icon="inline-start" />
                Seleccionar imagen
              </Button>
              {preview ? (
                <Button onClick={clearImage} type="button" variant="outline">
                  <XIcon data-icon="inline-start" />
                  Quitar imagen
                </Button>
              ) : null}
            </div>
            <Input
              accept="image/*"
              className="hidden"
              id="imagen"
              name="imagen"
              onChange={handleFileChange}
              ref={inputRef}
              type="file"
            />
          </div>
        </Field>
      </FormSection>

      <footer className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? (activeStep === formSteps.length - 1 ? "Revisa los hallazgos y guarda la ecografía." : "Continúa al siguiente apartado cuando termines.")}
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button disabled={isPending || activeStep === 0} onClick={() => goToStep(activeStep - 1)} type="button" variant="outline"><ArrowLeftIcon data-icon="inline-start" />Anterior</Button>
          {activeStep < formSteps.length - 1 ? (
            <Button disabled={isPending} onClick={() => goToStep(activeStep + 1)} type="button">Siguiente<ArrowRightIcon data-icon="inline-end" /></Button>
          ) : (
            <Button disabled={isPending} type="submit"><SaveIcon data-icon="inline-start" />{isPending ? "Guardando..." : "Guardar ecografía"}</Button>
          )}
        </div>
      </footer>
      </div>
      {confirmationDialog}
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
    <div className="flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 py-2">
      <Checkbox
        checked={checked}
        id={name}
        name={name}
        onCheckedChange={(nextValue) => onChange(nextValue === true)}
        value="true"
      />
      <Label htmlFor={name}>{label}</Label>
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
  const index = formSteps.findIndex((step) => step.id === id);
  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm" hidden={hidden} id={`ecografia-${id}`}>
      <div className="flex items-start gap-3 border-b bg-muted/20 p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
          {id === "imagen" ? <ImageIcon className="size-5" aria-hidden="true" /> : <ScanSearchIcon className="size-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Apartado {String(index + 1).padStart(2, "0")}</p>
          <h2 className="text-base font-semibold" id={`ecografia-${id}-title`} tabIndex={-1}>{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-5 p-4 sm:p-6">{children}</div>
    </section>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
