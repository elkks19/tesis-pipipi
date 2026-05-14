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
  UsersRoundIcon,
} from "lucide-react";

import { DateRangeField, Field, SelectField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  docenteRoles,
  estudianteRoles,
  type AuthRole,
} from "@/lib/auth-role-values";
import { CreateViajeSchema, tiposEstacion } from "@/lib/schema/viajes";

export type ViajeUserOption = {
  email: string;
  id: string;
  name: string;
  role: AuthRole | null;
};

type Emptyable<T extends string> = T | "";

type EstacionForm = {
  id: string;
  tipo: Emptyable<(typeof tiposEstacion)[number]>;
  docenteEncargado: string;
  estudiantes: string[];
};

export type ViajeFormValue = {
  servicio: string;
  fechaEntrada: string;
  fechaSalida: string;
  establecimiento: {
    nombre: string;
    direccion: string;
    contacto: string;
  };
  estaciones: EstacionForm[];
};

type ViajeFormActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type ViajeFormAction = (
  previousState: ViajeFormActionState,
  formData: FormData,
) => Promise<ViajeFormActionState>;

type ViajeFormProps = {
  action?: ViajeFormAction;
  defaultValue?: ViajeFormValue;
  successRedirectHref?: string;
  submitLabel?: string;
  users: ViajeUserOption[];
};

type UserComboboxOption = {
  email: string;
  label: string;
  name: string;
  role: AuthRole | null;
  value: string;
};

async function noopAction(): Promise<ViajeFormActionState> {
  return { ok: false };
}

function createEstacion(id = "estacion-0"): EstacionForm {
  return {
    id,
    tipo: "",
    docenteEncargado: "",
    estudiantes: [],
  };
}

function createBaseFormValue(): ViajeFormValue {
  return {
    servicio: "",
    fechaEntrada: "",
    fechaSalida: "",
    establecimiento: {
      nombre: "",
      direccion: "",
      contacto: "",
    },
    estaciones: [createEstacion()],
  };
}

function normalizeFormValue(value?: ViajeFormValue): ViajeFormValue {
  const formValue = value ?? createBaseFormValue();
  const estaciones =
    formValue.estaciones.length > 0 ? formValue.estaciones : [createEstacion()];

  return {
    ...formValue,
    estaciones: estaciones.map((estacion, index) => ({
      ...estacion,
      id: estacion.id || `estacion-${index}`,
    })),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildPayload(form: ViajeFormValue) {
  return {
    servicio: form.servicio.trim(),
    fechaEntrada: form.fechaEntrada,
    fechaSalida: form.fechaSalida,
    establecimiento: {
      nombre: form.establecimiento.nombre.trim(),
      direccion: optionalText(form.establecimiento.direccion),
      contacto: optionalText(form.establecimiento.contacto),
    },
    estaciones: form.estaciones.map((estacion) => ({
      tipo: estacion.tipo,
      docenteEncargado: estacion.docenteEncargado,
      estudiantes: estacion.estudiantes,
    })),
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

function getUserLabel(user: ViajeUserOption) {
  return `${user.name} (${user.email})`;
}

function getUserComboboxOption(user: ViajeUserOption): UserComboboxOption {
  return {
    email: user.email,
    label: getUserLabel(user),
    name: user.name,
    role: user.role,
    value: user.id,
  };
}

function getAvailableStationTypes(
  stations: EstacionForm[],
  currentIndex: number,
) {
  const selectedTypes = new Set(
    stations
      .filter((_, index) => index !== currentIndex)
      .map((station) => station.tipo)
      .filter(Boolean),
  );

  return tiposEstacion.filter((type) => !selectedTypes.has(type));
}

function getAssignedUserIds(stations: EstacionForm[], currentIndex: number) {
  return new Set(
    stations
      .filter((_, index) => index !== currentIndex)
      .flatMap((station) => [
        station.docenteEncargado,
        ...station.estudiantes,
      ])
      .filter(Boolean),
  );
}

function getAvailableUsers({
  currentValues,
  options,
  stations,
  currentIndex,
  blockedInCurrentStation = [],
}: {
  blockedInCurrentStation?: string[];
  currentIndex: number;
  currentValues: string[];
  options: UserComboboxOption[];
  stations: EstacionForm[];
}) {
  const assignedUserIds = getAssignedUserIds(stations, currentIndex);
  const currentValueIds = new Set(currentValues);
  const blockedCurrentIds = new Set(blockedInCurrentStation.filter(Boolean));

  return options.filter(
    (option) =>
      currentValueIds.has(option.value) ||
      (!assignedUserIds.has(option.value) && !blockedCurrentIds.has(option.value)),
  );
}

function hasRole(role: AuthRole | null, roles: readonly AuthRole[]) {
  return role !== null && roles.includes(role);
}

export function ViajeForm({
  action,
  defaultValue,
  successRedirectHref,
  submitLabel = "Guardar viaje",
  users,
}: ViajeFormProps) {
  const router = useRouter();
  const initialFormValue = useMemo(
    () => normalizeFormValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<ViajeFormValue>(initialFormValue);
  const [activeStationId, setActiveStationId] = useState(
    initialFormValue.estaciones[0].id,
  );
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

  const userOptions = useMemo(
    () => users.map((user) => getUserComboboxOption(user)),
    [users],
  );
  const userById = useMemo(
    () => new Map(userOptions.map((user) => [user.value, user])),
    [userOptions],
  );
  const docenteOptions = useMemo(
    () => userOptions.filter((user) => hasRole(user.role, docenteRoles)),
    [userOptions],
  );
  const estudianteOptions = useMemo(
    () => userOptions.filter((user) => hasRole(user.role, estudianteRoles)),
    [userOptions],
  );
  const allStationTypesSelected = form.estaciones.length >= tiposEstacion.length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const result = CreateViajeSchema.safeParse(buildPayload(form));

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

  function addStation() {
    if (allStationTypesSelected) {
      return;
    }

    const station = createEstacion(crypto.randomUUID());
    setForm((current) => ({
      ...current,
      estaciones: [...current.estaciones, station],
    }));
    setActiveStationId(station.id);
  }

  function removeStation(stationId: string) {
    setForm((current) => {
      if (current.estaciones.length === 1) {
        return current;
      }

      const nextStations = current.estaciones.filter(
        (station) => station.id !== stationId,
      );

      if (activeStationId === stationId) {
        setActiveStationId(nextStations[0].id);
      }

      return {
        ...current,
        estaciones: nextStations,
      };
    });
  }

  function updateStation(index: number, patch: Partial<EstacionForm>) {
    setForm((current) => ({
      ...current,
      estaciones: current.estaciones.map((station, stationIndex) =>
        stationIndex === index ? { ...station, ...patch } : station,
      ),
    }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <FormSection
        description="Datos generales del viaje y fechas de operacion."
        title="Datos del viaje"
      >
        <FieldGrid>
          <TextField
            error={visibleErrors.servicio}
            label="Servicio"
            name="servicio"
            onChange={(value) =>
              setForm((current) => ({ ...current, servicio: value }))
            }
            required
            value={form.servicio}
          />
          <DateRangeField
            endName="fechaSalida"
            error={visibleErrors.fechaEntrada ?? visibleErrors.fechaSalida}
            label="Rango de fechas"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                fechaEntrada: value.from,
                fechaSalida: value.to,
              }))
            }
            required
            startName="fechaEntrada"
            value={{
              from: form.fechaEntrada,
              to: form.fechaSalida,
            }}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        description="Municipio, centro o punto de atencion donde se trabajara."
        title="Establecimiento"
      >
        <FieldGrid>
          <TextField
            error={visibleErrors["establecimiento.nombre"]}
            label="Nombre"
            name="establecimiento.nombre"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                establecimiento: {
                  ...current.establecimiento,
                  nombre: value,
                },
              }))
            }
            required
            value={form.establecimiento.nombre}
          />
          <TextField
            error={visibleErrors["establecimiento.direccion"]}
            label="Direccion"
            name="establecimiento.direccion"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                establecimiento: {
                  ...current.establecimiento,
                  direccion: value,
                },
              }))
            }
            value={form.establecimiento.direccion}
          />
          <TextField
            error={visibleErrors["establecimiento.contacto"]}
            label="Contacto"
            name="establecimiento.contacto"
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                establecimiento: {
                  ...current.establecimiento,
                  contacto: value,
                },
              }))
            }
            value={form.establecimiento.contacto}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        action={
          <Button
            disabled={allStationTypesSelected}
            onClick={addStation}
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon data-icon="inline-start" />
            Nueva estacion
          </Button>
        }
        description="Cada pestana representa una estacion del flujo de atencion."
        title="Estaciones"
      >
        <Tabs value={activeStationId} onValueChange={setActiveStationId}>
          <div hidden>
            {form.estaciones.map((station, index) => (
              <div key={station.id}>
                <input
                  name={`estaciones.${index}.tipo`}
                  readOnly
                  type="hidden"
                  value={station.tipo}
                />
                <input
                  name={`estaciones.${index}.docenteEncargado`}
                  readOnly
                  type="hidden"
                  value={station.docenteEncargado}
                />
                {station.estudiantes.map((studentId) => (
                  <input
                    key={studentId}
                    name={`estaciones.${index}.estudiantes`}
                    readOnly
                    type="hidden"
                    value={studentId}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <TabsList className="w-max">
              {form.estaciones.map((station, index) => (
                <TabsTrigger key={station.id} value={station.id}>
                  {station.tipo || `Estacion ${index + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              disabled={allStationTypesSelected}
              onClick={addStation}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <PlusIcon />
              <span className="sr-only">Agregar estacion</span>
            </Button>
          </div>

          {form.estaciones.map((station, index) => (
            <TabsContent className="mt-4" key={station.id} value={station.id}>
              <div className="flex flex-col gap-5 rounded-3xl border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium">
                      Estacion {index + 1}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Define el tipo de estacion y asigna el equipo.
                    </p>
                  </div>
                  <Button
                    disabled={form.estaciones.length === 1}
                    onClick={() => removeStation(station.id)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Quitar
                  </Button>
                </div>

                <FieldGrid>
                  <SelectField
                    error={visibleErrors[`estaciones.${index}.tipo`]}
                    label="Tipo de estacion"
                    name={`estaciones.${index}.tipo`}
                    onChange={(value) => updateStation(index, { tipo: value })}
                    options={getAvailableStationTypes(form.estaciones, index)}
                    required
                    value={station.tipo}
                  />
                  <UserComboboxField
                    error={
                      visibleErrors[`estaciones.${index}.docenteEncargado`]
                    }
                    label="Docente encargado"
                    onChange={(value) =>
                      updateStation(index, { docenteEncargado: value })
                    }
                    options={getAvailableUsers({
                      blockedInCurrentStation: station.estudiantes,
                      currentIndex: index,
                      currentValues: station.docenteEncargado
                        ? [station.docenteEncargado]
                        : [],
                      options: docenteOptions,
                      stations: form.estaciones,
                    })}
                    placeholder="Buscar docente"
                    value={userById.get(station.docenteEncargado) ?? null}
                  />
                </FieldGrid>

                <UsersComboboxField
                  error={visibleErrors[`estaciones.${index}.estudiantes`]}
                  label="Estudiantes asignados"
                  onChange={(values) =>
                    updateStation(index, { estudiantes: values })
                  }
                  options={getAvailableUsers({
                    blockedInCurrentStation: station.docenteEncargado
                      ? [station.docenteEncargado]
                      : [],
                    currentIndex: index,
                    currentValues: station.estudiantes,
                    options: estudianteOptions,
                    stations: form.estaciones,
                  })}
                  value={station.estudiantes
                    .map((studentId) => userById.get(studentId))
                    .filter((user): user is UserComboboxOption =>
                      Boolean(user),
                    )}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </FormSection>

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-3xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? "Completa los campos para crear el viaje."}
        </p>
        <Button disabled={isPending} type="submit">
          <SaveIcon data-icon="inline-start" />
          {isPending ? "Guardando..." : submitLabel}
        </Button>
      </footer>
    </form>
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
    <section className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function UserComboboxField({
  error,
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  options: UserComboboxOption[];
  placeholder: string;
  value: UserComboboxOption | null;
}) {
  return (
    <Field error={error}>
      <Label>{label}</Label>
      <Combobox<UserComboboxOption>
        autoHighlight
        itemToStringLabel={(option) => option.label}
        items={options}
        isItemEqualToValue={(item, selectedValue) =>
          item.value === selectedValue.value
        }
        onValueChange={(nextValue) => onChange(nextValue?.value ?? "")}
        value={value}
      >
        <ComboboxInput
          aria-invalid={Boolean(error)}
          placeholder={placeholder}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>No se encontraron usuarios.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxLabel>Usuarios</ComboboxLabel>
              <ComboboxCollection>
                {(option: UserComboboxOption) => (
                  <ComboboxItem key={option.value} value={option}>
                    <UserOptionLabel option={option} />
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

function UsersComboboxField({
  error,
  label,
  onChange,
  options,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string[]) => void;
  options: UserComboboxOption[];
  value: UserComboboxOption[];
}) {
  const anchorRef = useComboboxAnchor();

  return (
    <Field error={error}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <UsersRoundIcon />
        <Label>{label}</Label>
      </div>
      <Combobox<UserComboboxOption, true>
        autoHighlight
        itemToStringLabel={(option) => option.label}
        items={options}
        isItemEqualToValue={(item, selectedValue) =>
          item.value === selectedValue.value
        }
        multiple
        onValueChange={(nextValue) =>
          onChange(nextValue.map((option) => option.value))
        }
        value={value}
      >
        <ComboboxChips ref={anchorRef}>
          {value.map((option) => (
            <ComboboxChip key={option.value}>
              {option.name}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput
            aria-invalid={Boolean(error)}
            placeholder={
              value.length > 0 ? "Agregar estudiante" : "Buscar estudiantes"
            }
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchorRef}>
          <ComboboxEmpty>No se encontraron usuarios.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxLabel>Usuarios</ComboboxLabel>
              <ComboboxCollection>
                {(option: UserComboboxOption) => (
                  <ComboboxItem key={option.value} value={option}>
                    <UserOptionLabel option={option} />
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

function UserOptionLabel({ option }: { option: UserComboboxOption }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{option.name}</span>
      <span className="truncate text-xs font-normal text-muted-foreground">
        {option.email}
      </span>
    </span>
  );
}
