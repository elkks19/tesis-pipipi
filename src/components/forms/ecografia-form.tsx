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
  ImageIcon,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  riniones: {
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
  riniones: {
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
    riniones: {
      derecho: {
        longitud: requiredNumber(state.riniones.derecho.longitud),
        parenquima: requiredNumber(state.riniones.derecho.parenquima),
      },
      izquierdo: {
        longitud: requiredNumber(state.riniones.izquierdo.longitud),
        parenquima: requiredNumber(state.riniones.izquierdo.parenquima),
      },
      ecogenicidad: state.riniones.ecogenicidad,
      relacionCorticoMedular: state.riniones.relacionCorticoMedular,
      diagnostico: state.riniones.diagnostico.trim(),
    },
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
    riniones: {
      ...baseFormValue.riniones,
      ...defaultValue?.riniones,
      derecho: {
        ...baseFormValue.riniones.derecho,
        ...defaultValue?.riniones?.derecho,
      },
      izquierdo: {
        ...baseFormValue.riniones.izquierdo,
        ...defaultValue?.riniones?.izquierdo,
      },
    },
  };
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(imagenPreview ?? "");
  const [isDragging, setIsDragging] = useState(false);
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
    const result = CreateEcografiaSchema.omit({ imagen: true }).safeParse(
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
    <form action={formAction} className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <Input name="historiaId" type="hidden" value={form.historiaId} />

      <FormSection
        description="Medidas y hallazgos principales del higado."
        title="Higado"
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
        description="Descripcion de paredes, contenido y diagnostico vesicular."
        title="Vesicula biliar"
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
        description="Mediciones renales y hallazgos ecograficos comparativos."
        title="Riniones"
      >
        <FieldGrid>
          <TextField
            error={visibleErrors["riniones.derecho.longitud"]}
            label="Rinon derecho longitud"
            min={0}
            name="riniones.derecho.longitud"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riniones: {
                  ...current.riniones,
                  derecho: { ...current.riniones.derecho, longitud: value },
                },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.riniones.derecho.longitud}
          />
          <TextField
            error={visibleErrors["riniones.derecho.parenquima"]}
            label="Rinon derecho parenquima"
            min={0}
            name="riniones.derecho.parenquima"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riniones: {
                  ...current.riniones,
                  derecho: { ...current.riniones.derecho, parenquima: value },
                },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.riniones.derecho.parenquima}
          />
          <TextField
            error={visibleErrors["riniones.izquierdo.longitud"]}
            label="Rinon izquierdo longitud"
            min={0}
            name="riniones.izquierdo.longitud"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riniones: {
                  ...current.riniones,
                  izquierdo: {
                    ...current.riniones.izquierdo,
                    longitud: value,
                  },
                },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.riniones.izquierdo.longitud}
          />
          <TextField
            error={visibleErrors["riniones.izquierdo.parenquima"]}
            label="Rinon izquierdo parenquima"
            min={0}
            name="riniones.izquierdo.parenquima"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riniones: {
                  ...current.riniones,
                  izquierdo: {
                    ...current.riniones.izquierdo,
                    parenquima: value,
                  },
                },
              }))
            }
            required
            step="0.1"
            type="number"
            value={form.riniones.izquierdo.parenquima}
          />
          <SelectField
            error={visibleErrors["riniones.ecogenicidad"]}
            label="Ecogenicidad"
            name="riniones.ecogenicidad"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riniones: { ...current.riniones, ecogenicidad: value },
              }))
            }
            options={tiposEcogenicidad}
            required
            value={form.riniones.ecogenicidad}
          />
          <SelectField
            error={visibleErrors["riniones.relacionCorticoMedular"]}
            label="Relacion cortico-medular"
            name="riniones.relacionCorticoMedular"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                riniones: {
                  ...current.riniones,
                  relacionCorticoMedular: value,
                },
              }))
            }
            options={tiposEcogenicidad}
            required
            value={form.riniones.relacionCorticoMedular}
          />
        </FieldGrid>
        <TextareaField
          error={visibleErrors["riniones.diagnostico"]}
          label="Diagnostico"
          name="riniones.diagnostico"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              riniones: { ...current.riniones, diagnostico: value },
            }))
          }
          required
          value={form.riniones.diagnostico}
        />
      </FormSection>

      <FormSection
        description="Adjunta una fotografia representativa del estudio realizado."
        title="Imagen de ecografia"
      >
        <Field error={visibleErrors.imagen}>
          <Label htmlFor="imagen">Foto de la ecografia</Label>
          <div
            className="flex flex-col gap-4 rounded-3xl border border-dashed bg-muted/30 p-4"
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDrop={handleDrop}
            data-dragging={isDragging}
          >
            {preview ? (
              <div className="overflow-hidden rounded-2xl border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Vista previa de ecografia"
                  className="max-h-80 w-full object-contain"
                  src={preview}
                />
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl bg-background px-6 py-8 text-center">
                <ImageIcon className="text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    Arrastra una imagen o seleccionala
                  </p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Se mostrara una vista previa antes de guardar el registro.
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

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-3xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? "Completa los hallazgos para guardar."}
        </p>
        <Button disabled={isPending} type="submit">
          <SaveIcon data-icon="inline-start" />
          {isPending ? "Guardando..." : "Guardar ecografia"}
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
