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
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  UserRoundPenIcon,
  UserRoundPlusIcon,
  RotateCcwIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldGroup as UIFieldGroup } from "@/components/ui/field";
import {
  DateField,
  Field,
  SelectField,
  TextField,
} from "@/components/forms/fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CreatePacienteSchema,
  generos,
  getPacienteAge,
  tiposDocumentoIdentidad,
} from "@/lib/schema/pacientes";
import { firstFieldErrors } from "@/lib/schema/field-errors";
import {
  booleanSummary,
  listSummary,
  textSummary,
  useSubmitConfirmation,
} from "@/components/forms/submit-confirmation";
import { cn } from "@/lib/utils";

type PacienteFormActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type PacienteFormAction = (
  previousState: PacienteFormActionState,
  formData: FormData,
) => Promise<PacienteFormActionState>;

type Emptyable<T extends string> = T | "";

type DatosPersonalesForm = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  documentoIdentidad: Emptyable<(typeof tiposDocumentoIdentidad)[number]>;
  numeroDocumentoIdentidad: string;
};

type PadreForm = {
  datosPersonales: DatosPersonalesForm;
  relacion: string;
  asumeSustento: boolean;
  numeroContacto: string;
};

type PadreFormDefaultValue = Partial<Omit<PadreForm, "datosPersonales">> & {
  datosPersonales?: Partial<DatosPersonalesForm>;
};

export type PacienteFormValue = {
  datosPersonales: DatosPersonalesForm;
  genero: Emptyable<(typeof generos)[number]>;
  lugarNacimiento: {
    pais: string;
    departamento: string;
    distrito: string;
  };
  nacionalidad: string;
  etnia: string;
  padres: PadreForm[];
};

export type PacienteFormDefaultValue = Partial<
  Omit<PacienteFormValue, "datosPersonales" | "lugarNacimiento" | "padres">
> & {
  datosPersonales?: Partial<DatosPersonalesForm>;
  lugarNacimiento?: Partial<PacienteFormValue["lugarNacimiento"]>;
  padres?: PadreFormDefaultValue[];
};

type PacienteFormProps = {
  mode?: "create" | "edit";
  action?: PacienteFormAction;
  defaultValue?: PacienteFormDefaultValue;
  successRedirectHref?: string;
};

const emptyDatosPersonales: DatosPersonalesForm = {
  nombres: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  fechaNacimiento: "",
  documentoIdentidad: "",
  numeroDocumentoIdentidad: "",
};

const baseFormValue: PacienteFormValue = {
  datosPersonales: { ...emptyDatosPersonales },
  genero: "",
  lugarNacimiento: {
    pais: "Bolivia",
    departamento: "",
    distrito: "",
  },
  nacionalidad: "Boliviana",
  etnia: "",
  padres: [],
};

async function noopAction(): Promise<PacienteFormActionState> {
  return {
    ok: false,
  };
}

function createPadre(defaultValue?: PadreFormDefaultValue) {
  return {
    datosPersonales: {
      ...emptyDatosPersonales,
      ...defaultValue?.datosPersonales,
    },
    relacion: defaultValue?.relacion ?? "",
    asumeSustento: defaultValue?.asumeSustento ?? false,
    numeroContacto: defaultValue?.numeroContacto ?? "",
  };
}

function createInitialValue(defaultValue?: PacienteFormDefaultValue) {
  return {
    ...baseFormValue,
    ...defaultValue,
    datosPersonales: {
      ...baseFormValue.datosPersonales,
      ...defaultValue?.datosPersonales,
    },
    lugarNacimiento: {
      ...baseFormValue.lugarNacimiento,
      ...defaultValue?.lugarNacimiento,
    },
    padres: defaultValue?.padres?.map((padre) => createPadre(padre)) ?? [],
  };
}

function getFullName(datos: DatosPersonalesForm) {
  return [
    datos.nombres,
    datos.apellidoPaterno,
    datos.apellidoMaterno,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
}

function getConfirmationSections(
  form: PacienteFormValue,
  shouldIncludePadres: boolean,
) {
  return [
    {
      title: "Paciente",
      items: [
        { label: "Nombre completo", value: textSummary(getFullName(form.datosPersonales)) },
        { label: "Fecha de nacimiento", value: textSummary(form.datosPersonales.fechaNacimiento) },
        {
          label: "Documento",
          value: textSummary(
            `${form.datosPersonales.documentoIdentidad} ${form.datosPersonales.numeroDocumentoIdentidad}`.trim(),
          ),
        },
        { label: "Genero", value: textSummary(form.genero) },
      ],
    },
    {
      title: "Procedencia",
      items: [
        { label: "Pais", value: textSummary(form.lugarNacimiento.pais) },
        { label: "Departamento", value: textSummary(form.lugarNacimiento.departamento) },
        { label: "Distrito o municipio", value: textSummary(form.lugarNacimiento.distrito) },
        { label: "Nacionalidad", value: textSummary(form.nacionalidad) },
      ],
    },
    {
      title: "Padres o tutores",
      items: [
        {
          label: "Registros incluidos",
          value: shouldIncludePadres
            ? listSummary(
                form.padres.map((padre) => {
                  const nombre = getFullName(padre.datosPersonales);
                  return `${nombre || "Sin nombre"} - ${padre.relacion || "Sin relacion"} (${booleanSummary(
                    padre.asumeSustento,
                    "asume sustento",
                    "no asume sustento",
                  )})`;
                }),
              )
            : "No aplica por edad",
        },
      ],
    },
  ];
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isMinor(fechaNacimiento: string) {
  const age = getPacienteAge(fechaNacimiento);

  return age !== null && age < 18;
}

function buildPayload(state: PacienteFormValue) {
  return {
    datosPersonales: {
      ...state.datosPersonales,
      nombres: state.datosPersonales.nombres.trim(),
      apellidoPaterno: state.datosPersonales.apellidoPaterno.trim(),
      apellidoMaterno: state.datosPersonales.apellidoMaterno.trim(),
      numeroDocumentoIdentidad:
        state.datosPersonales.numeroDocumentoIdentidad.trim(),
    },
    genero: state.genero,
    lugarNacimiento: {
      pais: state.lugarNacimiento.pais.trim(),
      departamento: state.lugarNacimiento.departamento.trim(),
      distrito: normalizeOptional(state.lugarNacimiento.distrito),
    },
    nacionalidad: state.nacionalidad.trim(),
    etnia: normalizeOptional(state.etnia),
    padres:
      state.padres.length > 0
        ? state.padres.map((padre) => ({
            datosPersonales: {
              ...padre.datosPersonales,
              nombres: padre.datosPersonales.nombres.trim(),
              apellidoPaterno: padre.datosPersonales.apellidoPaterno.trim(),
              apellidoMaterno: padre.datosPersonales.apellidoMaterno.trim(),
              numeroDocumentoIdentidad:
                padre.datosPersonales.numeroDocumentoIdentidad.trim(),
            },
            relacion: padre.relacion.trim(),
            asumeSustento: padre.asumeSustento,
            numeroContacto: padre.numeroContacto.trim(),
          }))
        : undefined,
  };
}

export function PacienteForm({
  mode = "create",
  action,
  defaultValue,
  successRedirectHref,
}: PacienteFormProps) {
  const isEditing = mode === "edit";
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<PacienteFormValue>(initialValue);
  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialValue);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submission, setSubmission] = useState<{ form: PacienteFormValue; actionState: PacienteFormActionState } | null>(null);
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: isEditing ? "Guardar cambios" : "Guardar paciente",
    });
  const isPacienteMenor = isMinor(form.datosPersonales.fechaNacimiento);
  const shouldShowPadres = isPacienteMenor || form.padres.length > 0;
  const validation = useMemo(() => CreatePacienteSchema.safeParse(buildPayload(form)), [form]);
  const allErrors = validation.success ? {} : firstFieldErrors(validation.error);
  const serverErrors = submission?.form === form && submission.actionState !== actionState
    ? actionState.errors ?? {}
    : {};
  const showValidation = !isPending && !actionState.ok;
  const visibleErrors = Object.fromEntries(
    Object.entries({ ...serverErrors, ...allErrors }).filter(([path]) => showValidation && (submitted || touched.has(path))),
  );

  function updateDatosPersonales<T extends keyof DatosPersonalesForm>(
    field: T,
    value: DatosPersonalesForm[T],
  ) {
    setForm((current) => ({
      ...current,
      datosPersonales: {
        ...current.datosPersonales,
        [field]: value,
      },
    }));
  }

  function updatePadreDatos<T extends keyof DatosPersonalesForm>(
    index: number,
    field: T,
    value: DatosPersonalesForm[T],
  ) {
    setForm((current) => ({
      ...current,
      padres: current.padres.map((padre, padreIndex) =>
        padreIndex === index
          ? {
              ...padre,
              datosPersonales: {
                ...padre.datosPersonales,
                [field]: value,
              },
            }
          : padre,
      ),
    }));
  }

  function addPadre() {
    setForm((current) => ({
      ...current,
      padres: [...current.padres, createPadre()],
    }));
  }

  function removePadre(index: number) {
    setTouched((current) => new Set([...current].filter((path) => !path.startsWith("padres."))));
    setForm((current) => ({
      ...current,
      padres: current.padres.filter((_, padreIndex) => padreIndex !== index),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitted(true);
    setSubmission({ form, actionState });
    if (!validation.success) {
      event.preventDefault();
      const firstPath = Object.keys(allErrors)[0];
      window.requestAnimationFrame(() => document.getElementById(firstPath)?.focus());
      return;
    }

    if (!confirmSubmit(event, getConfirmationSections(form, shouldShowPadres))) {
      return;
    }
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

  if (actionState.ok && successRedirectHref) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8" role="status">
        <p className="text-sm text-muted-foreground">Paciente guardado. Redirigiendo...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-2 sm:py-3">
      {isEditing ? (
        <header className="flex flex-col gap-5">
          {successRedirectHref ? (
            <div>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => router.push(successRedirectHref)}>
                <ArrowLeftIcon data-icon="inline-start" />
                Volver a pacientes
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <UserRoundPenIcon className="size-6" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Ficha del paciente</p>
                <h1 className="text-2xl font-semibold tracking-tight">Editar paciente</h1>
                <p className="text-sm text-muted-foreground">{getFullName(initialValue.datosPersonales)}</p>
              </div>
            </div>
            <p role="status" className={cn("text-xs text-muted-foreground", hasChanges && "text-primary")}>
              {hasChanges ? "Cambios sin guardar" : "Sin cambios pendientes"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Actualiza la información de la ficha. Los campos con <span className="text-destructive">*</span> son obligatorios.</p>
        </header>
      ) : (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <UserRoundPlusIcon className="size-6" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Registro de pacientes</p>
              <h1 className="text-2xl font-semibold tracking-tight">Nuevo paciente</h1>
              <p className="text-sm text-muted-foreground">Registra su identidad y procedencia para abrir su ficha.</p>
            </div>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground"><span className="text-destructive">*</span> Campos obligatorios</p>
        </header>
      )}
      <form
        action={formAction}
        className="flex flex-col gap-5"
        noValidate
        onBlurCapture={(event) => {
          const control = event.target as HTMLElement;
          const path = control.id || control.getAttribute("name");
          if (path) setTouched((current) => new Set(current).add(path));
        }}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <FormSection
          number="01"
          description="Identificación y datos personales del paciente."
          title="Datos personales"
        >
          <FieldGroup>
            <TextField
              error={visibleErrors["datosPersonales.nombres"]}
              label="Nombres"
              name="datosPersonales.nombres"
              onChange={(value) => updateDatosPersonales("nombres", value)}
              required
              value={form.datosPersonales.nombres}
            />
            <TextField
              error={visibleErrors["datosPersonales.apellidoPaterno"]}
              label="Apellido paterno"
              name="datosPersonales.apellidoPaterno"
              onChange={(value) =>
                updateDatosPersonales("apellidoPaterno", value)
              }
              required
              value={form.datosPersonales.apellidoPaterno}
            />
            <TextField
              error={visibleErrors["datosPersonales.apellidoMaterno"]}
              label="Apellido materno"
              name="datosPersonales.apellidoMaterno"
              onChange={(value) =>
                updateDatosPersonales("apellidoMaterno", value)
              }
              value={form.datosPersonales.apellidoMaterno}
            />
            <DateField
              error={visibleErrors["datosPersonales.fechaNacimiento"]}
              label="Fecha de nacimiento"
              name="datosPersonales.fechaNacimiento"
              onChange={(value) =>
                updateDatosPersonales("fechaNacimiento", value)
              }
              required
              value={form.datosPersonales.fechaNacimiento}
            />
            <SelectField
              error={visibleErrors["datosPersonales.documentoIdentidad"]}
              label="Documento"
              name="datosPersonales.documentoIdentidad"
              onChange={(value) =>
                updateDatosPersonales("documentoIdentidad", value)
              }
              options={tiposDocumentoIdentidad}
              required
              value={form.datosPersonales.documentoIdentidad}
            />
            <TextField
              error={visibleErrors["datosPersonales.numeroDocumentoIdentidad"]}
              label="Número de documento"
              name="datosPersonales.numeroDocumentoIdentidad"
              onChange={(value) =>
                updateDatosPersonales("numeroDocumentoIdentidad", value)
              }
              required
              value={form.datosPersonales.numeroDocumentoIdentidad}
            />
            <SelectField
              error={visibleErrors.genero}
              label="Género"
              name="genero"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  genero: value as PacienteFormValue["genero"],
                }))
              }
              options={generos}
              required
              value={form.genero}
            />
          </FieldGroup>
        </FormSection>

        <FormSection
          number="02"
          description="Lugar de nacimiento y pertenencia cultural."
          title="Procedencia"
        >
          <FieldGroup>
            <TextField
              error={visibleErrors["lugarNacimiento.pais"]}
              label="País"
              name="lugarNacimiento.pais"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  lugarNacimiento: {
                    ...current.lugarNacimiento,
                    pais: value,
                  },
                }))
              }
              required
              value={form.lugarNacimiento.pais}
            />
            <TextField
              error={visibleErrors["lugarNacimiento.departamento"]}
              label="Departamento"
              name="lugarNacimiento.departamento"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  lugarNacimiento: {
                    ...current.lugarNacimiento,
                    departamento: value,
                  },
                }))
              }
              required
              value={form.lugarNacimiento.departamento}
            />
            <TextField
              error={visibleErrors["lugarNacimiento.distrito"]}
              label="Distrito o municipio"
              name="lugarNacimiento.distrito"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  lugarNacimiento: {
                    ...current.lugarNacimiento,
                    distrito: value,
                  },
                }))
              }
              value={form.lugarNacimiento.distrito}
            />
            <TextField
              error={visibleErrors.nacionalidad}
              label="Nacionalidad"
              name="nacionalidad"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  nacionalidad: value,
                }))
              }
              required
              value={form.nacionalidad}
            />
            <TextField
              error={visibleErrors.etnia}
              label="Etnia"
              name="etnia"
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  etnia: value,
                }))
              }
              value={form.etnia}
            />
          </FieldGroup>
        </FormSection>

        {shouldShowPadres ? (
          <FormSection
            number="03"
            action={
              <Button
                aria-describedby={visibleErrors.padres ? "padres-error" : undefined}
                aria-invalid={Boolean(visibleErrors.padres)}
                id="padres"
                onClick={addPadre}
                size="sm"
                type="button"
                variant="outline"
              >
                <PlusIcon data-icon="inline-start" />
                Agregar
              </Button>
            }
            description="Informacion del responsable legal del paciente menor de edad."
            title="Padres o responsables"
          >
            {visibleErrors.padres ? <p className="mb-3 text-sm text-destructive" id="padres-error" role="alert">{visibleErrors.padres}</p> : null}
            {form.padres.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Sin responsables registrados.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {form.padres.map((padre, index) => (
                  <fieldset
                    className="flex flex-col gap-4 rounded-md border bg-background p-4"
                    key={index}
                  >
                    <legend className="px-1 text-sm font-medium">
                      Responsable {index + 1}
                    </legend>
                    <FieldGroup>
                      <TextField
                        error={
                          visibleErrors[
                            `padres.${index}.datosPersonales.nombres`
                          ]
                        }
                        label="Nombres"
                        name={`padres.${index}.datosPersonales.nombres`}
                        onChange={(value) =>
                          updatePadreDatos(index, "nombres", value)
                        }
                        required
                        value={padre.datosPersonales.nombres}
                      />
                      <TextField
                        error={
                          visibleErrors[
                            `padres.${index}.datosPersonales.apellidoPaterno`
                          ]
                        }
                        label="Apellido paterno"
                        name={`padres.${index}.datosPersonales.apellidoPaterno`}
                        onChange={(value) =>
                          updatePadreDatos(index, "apellidoPaterno", value)
                        }
                        required
                        value={padre.datosPersonales.apellidoPaterno}
                      />
                      <TextField
                        error={
                          visibleErrors[
                            `padres.${index}.datosPersonales.apellidoMaterno`
                          ]
                        }
                        label="Apellido materno"
                        name={`padres.${index}.datosPersonales.apellidoMaterno`}
                        onChange={(value) =>
                          updatePadreDatos(index, "apellidoMaterno", value)
                        }
                        value={padre.datosPersonales.apellidoMaterno}
                      />
                      <DateField
                        error={
                          visibleErrors[
                            `padres.${index}.datosPersonales.fechaNacimiento`
                          ]
                        }
                        label="Fecha de nacimiento"
                        name={`padres.${index}.datosPersonales.fechaNacimiento`}
                        onChange={(value) =>
                          updatePadreDatos(index, "fechaNacimiento", value)
                        }
                        required
                        value={padre.datosPersonales.fechaNacimiento}
                      />
                      <SelectField
                        error={
                          visibleErrors[
                            `padres.${index}.datosPersonales.documentoIdentidad`
                          ]
                        }
                        label="Documento"
                        name={`padres.${index}.datosPersonales.documentoIdentidad`}
                        onChange={(value) =>
                          updatePadreDatos(index, "documentoIdentidad", value)
                        }
                        options={tiposDocumentoIdentidad}
                        required
                        value={padre.datosPersonales.documentoIdentidad}
                      />
                      <TextField
                        error={
                          visibleErrors[
                            `padres.${index}.datosPersonales.numeroDocumentoIdentidad`
                          ]
                        }
                        label="Numero de documento"
                        name={`padres.${index}.datosPersonales.numeroDocumentoIdentidad`}
                        onChange={(value) =>
                          updatePadreDatos(
                            index,
                            "numeroDocumentoIdentidad",
                            value,
                          )
                        }
                        required
                        value={padre.datosPersonales.numeroDocumentoIdentidad}
                      />
                      <TextField
                        error={visibleErrors[`padres.${index}.relacion`]}
                        label="Relacion"
                        name={`padres.${index}.relacion`}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            padres: current.padres.map((item, padreIndex) =>
                              padreIndex === index
                                ? { ...item, relacion: value }
                                : item,
                            ),
                          }))
                        }
                        required
                        value={padre.relacion}
                      />
                      <TextField
                        error={visibleErrors[`padres.${index}.numeroContacto`]}
                        label="Numero de contacto"
                        name={`padres.${index}.numeroContacto`}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            padres: current.padres.map((item, padreIndex) =>
                              padreIndex === index
                                ? { ...item, numeroContacto: value }
                                : item,
                            ),
                          }))
                        }
                        required
                        type="tel"
                        value={padre.numeroContacto}
                      />
                    </FieldGroup>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Field className="flex-row items-center">
                        <Checkbox
                          checked={padre.asumeSustento}
                          name={`padres.${index}.asumeSustento`}
                          onCheckedChange={(checked) =>
                            setForm((current) => ({
                              ...current,
                              padres: current.padres.map((item, padreIndex) =>
                                padreIndex === index
                                  ? {
                                      ...item,
                                      asumeSustento: checked === true,
                                    }
                                  : item,
                              ),
                            }))
                          }
                          value="true"
                        />
                        <Label>Asume sustento del paciente</Label>
                      </Field>
                      <Button
                        onClick={() => removePadre(index)}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Quitar responsable
                      </Button>
                    </div>
                  </fieldset>
                ))}
              </div>
            )}
          </FormSection>
        ) : null}

        <footer className="sticky bottom-0 flex flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p
            className={cn("text-sm text-muted-foreground", actionState.message && "text-foreground")}
            aria-live="polite"
          >
            {actionState.message ?? (isEditing ? (hasChanges ? "Revisa los datos antes de guardar los cambios." : "Los datos de la ficha están actualizados.") : "Completa los campos obligatorios para registrar la ficha.")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isPending || (isEditing && !hasChanges)}
              onClick={() => {
                setForm(initialValue);
                setTouched(new Set());
                setSubmitted(false);
                setSubmission(null);
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              {isEditing ? "Restablecer" : "Limpiar"}
            </Button>
            <Button disabled={isPending || (isEditing && !hasChanges)} type="submit">
              <SaveIcon data-icon="inline-start" />
              {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar paciente"}
            </Button>
          </div>
        </footer>
        {confirmationDialog}
      </form>
    </div>
  );
}

function FormSection({
  number,
  action,
  children,
  description,
  title,
}: {
  number: string;
  action?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-muted/20 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-xs font-semibold tabular-nums text-primary">{number}</span>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {action}
      </div>
      <div className="min-w-0 p-5 sm:p-6">{children}</div>
    </section>
  );
}

function FieldGroup({ children }: { children: ReactNode }) {
  return (
    <UIFieldGroup className="grid gap-x-5 gap-y-5 sm:grid-cols-2 xl:grid-cols-3 [&_[data-slot=select-trigger]]:w-full">{children}</UIFieldGroup>
  );
}
