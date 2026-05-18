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
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
  tiposDocumentoIdentidad,
} from "@/lib/schema/pacientes";
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

type FieldErrors = Record<string, string>;

type PacienteFormProps = {
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

function getAge(fechaNacimiento: string) {
  if (!fechaNacimiento) {
    return null;
  }

  const birthDate = new Date(`${fechaNacimiento}T00:00:00`);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasNotHadBirthdayThisYear =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate());

  if (hasNotHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

function isMinor(fechaNacimiento: string) {
  const age = getAge(fechaNacimiento);

  return age !== null && age < 18;
}

function buildPayload(state: PacienteFormValue, shouldIncludePadres: boolean) {
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
      shouldIncludePadres && state.padres.length > 0
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

function getErrorMap(error: unknown): FieldErrors {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray(error.issues)
  ) {
    return error.issues.reduce<FieldErrors>((acc, issue) => {
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

export function PacienteForm({
  action,
  defaultValue,
  successRedirectHref,
}: PacienteFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<PacienteFormValue>(initialValue);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "validated">("idle");
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: "Guardar paciente",
    });
  const shouldShowPadres = isMinor(form.datosPersonales.fechaNacimiento);

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
    setForm((current) => ({
      ...current,
      padres: current.padres.filter((_, padreIndex) => padreIndex !== index),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const result = CreatePacienteSchema.safeParse(
      buildPayload(form, shouldShowPadres),
    );

    if (!result.success) {
      event.preventDefault();
      setErrors(getErrorMap(result.error));
      setStatus("idle");
      return;
    }

    setErrors({});
    setStatus("validated");

    if (!confirmSubmit(event, getConfirmationSections(form, shouldShowPadres))) {
      return;
    }
  }

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <form
        action={formAction}
        className="flex flex-col gap-6"
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <FormSection
          description="Identificacion y datos necesarios para abrir la historia."
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
              required
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
              label="Numero de documento"
              name="datosPersonales.numeroDocumentoIdentidad"
              onChange={(value) =>
                updateDatosPersonales("numeroDocumentoIdentidad", value)
              }
              required
              value={form.datosPersonales.numeroDocumentoIdentidad}
            />
            <SelectField
              error={visibleErrors.genero}
              label="Genero"
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
          description="Origen del paciente para organizar atencion por comunidad."
          title="Procedencia"
        >
          <FieldGroup>
            <TextField
              error={visibleErrors["lugarNacimiento.pais"]}
              label="Pais"
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
            action={
              <Button
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
                        required
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
            className={cn(
              "text-sm text-muted-foreground",
              (status === "validated" || actionState.message) &&
                "text-foreground",
            )}
            aria-live="polite"
          >
            {actionState.message ??
              (status === "validated"
                ? "Paciente validado. Enviando a la accion del formulario."
                : "Completa los campos obligatorios para registrar la ficha.")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="reset"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setForm(initialValue);
                setErrors({});
                setStatus("idle");
              }}
            >
              Limpiar
            </Button>
            <Button disabled={isPending} type="submit">
              <SaveIcon data-icon="inline-start" />
              {isPending ? "Guardando..." : "Guardar paciente"}
            </Button>
          </div>
        </footer>
        {confirmationDialog}
      </form>
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

function FieldGroup({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  );
}
