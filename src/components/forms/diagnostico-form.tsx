"use client";

import {
  type FormEvent,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { PackageSearchIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  IcdCodePicker,
  type IcdCodeValue,
  TextareaField,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { CreateRecetaSchema } from "@/lib/schema/farmacia";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  listSummary,
  textSummary,
  useSubmitConfirmation,
} from "@/components/forms/submit-confirmation";
import { CreateDiagnosticoSchema } from "@/lib/schema/diagnostico";
import type { ViajeInventarioItem } from "@/lib/schema/farmacia";

export type DiagnosticoFormValue = {
  historiaId: string;
  receta: RecetaFormValue;
  planTrabajo: string;
  principal: IcdCodeValue;
  recetaId: string;
  secundarios: IcdCodeValue[];
};

type RecetaFormValue = {
  indicacionesGenerales: string;
  medicamentos: RecetaMedicamentoFormValue[];
};

type RecetaMedicamentoFormValue = {
  cantidad: string;
  catalogoId: string;
  concentracion: string;
  dosis: string;
  duracion: string;
  formaFarmaceutica: string;
  frecuencia: string;
  indicaciones: string;
  inventarioItemId: string;
  nombre: string;
  principioActivo: string;
  unidad: string;
  viaAdministracion: string;
};

type DiagnosticoActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type DiagnosticoAction = (
  previousState: DiagnosticoActionState,
  formData: FormData,
) => Promise<DiagnosticoActionState>;

type DiagnosticoFormProps = {
  action?: DiagnosticoAction;
  defaultValue?: Partial<DiagnosticoFormValue>;
  inventarioItems?: ViajeInventarioItem[];
  successRedirectHref?: string;
};

const emptyIcdCode: IcdCodeValue = {
  code: "",
  iNo: "",
  title: "",
};

const baseFormValue: DiagnosticoFormValue = {
  historiaId: "",
  receta: {
    indicacionesGenerales: "",
    medicamentos: [],
  },
  planTrabajo: "",
  principal: emptyIcdCode,
  recetaId: "",
  secundarios: [],
};

async function noopAction(): Promise<DiagnosticoActionState> {
  return { ok: false };
}

function buildPayload(state: DiagnosticoFormValue) {
  const medicamentos = state.receta.medicamentos.filter((medicamento) =>
    medicamento.nombre.trim() ||
    medicamento.dosis.trim() ||
    medicamento.frecuencia.trim() ||
    medicamento.duracion.trim(),
  );

  return {
    historiaId: state.historiaId,
    principal: state.principal,
    secundarios: state.secundarios.filter((diagnostico) => diagnostico.iNo),
    planTrabajo: state.planTrabajo.trim(),
    ...(state.recetaId.trim() ? { recetaId: state.recetaId.trim() } : {}),
    receta: {
      indicacionesGenerales: state.receta.indicacionesGenerales.trim(),
      medicamentos: medicamentos.map((medicamento) => ({
        cantidad: medicamento.cantidad.trim() || undefined,
        catalogoId: medicamento.catalogoId.trim() || undefined,
        concentracion: medicamento.concentracion.trim() || undefined,
        dosis: medicamento.dosis.trim(),
        duracion: medicamento.duracion.trim(),
        formaFarmaceutica: medicamento.formaFarmaceutica.trim() || undefined,
        frecuencia: medicamento.frecuencia.trim(),
        indicaciones: medicamento.indicaciones.trim() || undefined,
        inventarioItemId: medicamento.inventarioItemId.trim() || undefined,
        nombre: medicamento.nombre.trim(),
        principioActivo: medicamento.principioActivo.trim() || undefined,
        unidad: medicamento.unidad.trim() || undefined,
        viaAdministracion: medicamento.viaAdministracion.trim() || undefined,
      })),
    },
  };
}

function createInitialValue(defaultValue?: Partial<DiagnosticoFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
    principal: {
      ...emptyIcdCode,
      ...defaultValue?.principal,
    },
    receta: {
      indicacionesGenerales: defaultValue?.receta?.indicacionesGenerales ?? "",
      medicamentos: defaultValue?.receta?.medicamentos ?? [],
    },
    secundarios: defaultValue?.secundarios ?? [],
  };
}

function diagnosisSummary(diagnostico: IcdCodeValue) {
  return diagnostico.title || diagnostico.code || diagnostico.iNo;
}

function createEmptyMedication(): RecetaMedicamentoFormValue {
  return {
    cantidad: "",
    catalogoId: "",
    concentracion: "",
    dosis: "",
    duracion: "",
    formaFarmaceutica: "",
    frecuencia: "",
    indicaciones: "",
    inventarioItemId: "",
    nombre: "",
    principioActivo: "",
    unidad: "",
    viaAdministracion: "",
  };
}

function inventarioItemToMedicationForm(
  item: ViajeInventarioItem,
): RecetaMedicamentoFormValue {
  return {
    ...createEmptyMedication(),
    cantidad: "",
    catalogoId: item.catalogoId ?? "",
    concentracion: item.concentracion ?? "",
    formaFarmaceutica: item.formaFarmaceutica ?? "",
    inventarioItemId: item.id,
    nombre: item.nombre,
    principioActivo: item.principioActivo ?? "",
    unidad: item.unidad,
    viaAdministracion: item.viaAdministracion ?? "",
  };
}

function getConfirmationSections(form: DiagnosticoFormValue) {
  return [
    {
      title: "Diagnosticos",
      items: [
        {
          label: "Principal",
          value: textSummary(diagnosisSummary(form.principal)),
        },
        {
          label: "Secundarios",
          value: listSummary(
            form.secundarios
              .filter((diagnostico) => diagnostico.iNo)
              .map((diagnostico) => diagnosisSummary(diagnostico)),
          ),
        },
      ],
    },
    {
      title: "Receta",
      items: [
        {
          label: "Medicamentos",
          value: listSummary(
            form.receta.medicamentos
              .filter((medicamento) => medicamento.nombre)
              .map(
                (medicamento) =>
                  `${medicamento.nombre} - ${medicamento.dosis} - ${medicamento.frecuencia}`,
              ),
          ),
        },
        {
          label: "Indicaciones generales",
          value: textSummary(form.receta.indicacionesGenerales),
        },
      ],
    },
    {
      title: "Plan",
      items: [
        { label: "Plan de trabajo", value: textSummary(form.planTrabajo) },
      ],
    },
  ];
}

export function DiagnosticoForm({
  action,
  defaultValue,
  inventarioItems = [],
  successRedirectHref,
}: DiagnosticoFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<DiagnosticoFormValue>(initialValue);
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: "Guardar diagnostico",
    });
  const validation = CreateDiagnosticoSchema.extend({ receta: CreateRecetaSchema }).safeParse(buildPayload(form));
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
    if (revealErrors(event)) {
      return;
    }

    if (!confirmSubmit(event, getConfirmationSections(form))) {
      return;
    }
  }

  function updateSecondary(index: number, value: IcdCodeValue) {
    setForm((current) => ({
      ...current,
      secundarios: current.secundarios.map((diagnostico, currentIndex) =>
        currentIndex === index ? value : diagnostico,
      ),
    }));
  }

  function addEmptyMedication() {
    setForm((current) => ({
      ...current,
      receta: {
        ...current.receta,
        medicamentos: [...current.receta.medicamentos, createEmptyMedication()],
      },
    }));
  }

  function addInventoryMedication(item: ViajeInventarioItem) {
    setForm((current) => ({
      ...current,
      receta: {
        ...current.receta,
        medicamentos: [
          ...current.receta.medicamentos,
          inventarioItemToMedicationForm(item),
        ],
      },
    }));
  }

  function updateMedication(
    index: number,
    patch: Partial<RecetaMedicamentoFormValue>,
  ) {
    setForm((current) => ({
      ...current,
      receta: {
        ...current.receta,
        medicamentos: current.receta.medicamentos.map((medicamento, currentIndex) =>
          currentIndex === index ? { ...medicamento, ...patch } : medicamento,
        ),
      },
    }));
  }

  function removeMedication(index: number) {
    setForm((current) => ({
      ...current,
      receta: {
        ...current.receta,
        medicamentos: current.receta.medicamentos.filter(
          (_medicamento, currentIndex) => currentIndex !== index,
        ),
      },
    }));
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
      <input name="historiaId" type="hidden" value={form.historiaId} />
      <input name="recetaId" type="hidden" value={form.recetaId} />

      <section className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Diagnostico principal</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Selecciona el diagnostico principal usando la herramienta CIE-11.
          </p>
        </div>
        <IcdCodePicker
          baseName="principal"
          error={
            visibleErrors["principal.title"] ??
            visibleErrors["principal.iNo"] ??
            visibleErrors.principal
          }
          label="Diagnostico CIE-11"
          onChange={(value) =>
            setForm((current) => ({ ...current, principal: value }))
          }
          value={form.principal}
        />
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Receta</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Arma la receta desde el inventario del viaje o agrega medicamentos manualmente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <InventarioDialog
              inventarioItems={inventarioItems}
              onSelect={addInventoryMedication}
            />
            <Button onClick={addEmptyMedication} type="button" variant="outline">
              <PlusIcon data-icon="inline-start" />
              Agregar manual
            </Button>
          </div>
        </div>

        <TextareaField
          error={visibleErrors["receta.indicacionesGenerales"]}
          label="Indicaciones generales"
          name="receta.indicacionesGenerales"
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              receta: {
                ...current.receta,
                indicacionesGenerales: value,
              },
            }))
          }
          placeholder="Reposo, hidratacion, signos de alarma, control..."
          value={form.receta.indicacionesGenerales}
        />

        <div className="flex flex-col gap-3">
          {form.receta.medicamentos.length > 0 ? (
            form.receta.medicamentos.map((medicamento, index) => (
              <div
                className="grid gap-3 rounded-3xl border bg-muted/30 p-3"
                key={index}
              >
                <input name={`receta.medicamentos.${index}.catalogoId`} type="hidden" value={medicamento.catalogoId} />
                <input name={`receta.medicamentos.${index}.inventarioItemId`} type="hidden" value={medicamento.inventarioItemId} />
                <input name={`receta.medicamentos.${index}.principioActivo`} type="hidden" value={medicamento.principioActivo} />
                <input name={`receta.medicamentos.${index}.concentracion`} type="hidden" value={medicamento.concentracion} />
                <input name={`receta.medicamentos.${index}.formaFarmaceutica`} type="hidden" value={medicamento.formaFarmaceutica} />
                <input name={`receta.medicamentos.${index}.viaAdministracion`} type="hidden" value={medicamento.viaAdministracion} />
                <input name={`receta.medicamentos.${index}.unidad`} type="hidden" value={medicamento.unidad} />
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
                  <TextField
                    error={visibleErrors[`receta.medicamentos.${index}.nombre`]}
                    label="Medicamento"
                    name={`receta.medicamentos.${index}.nombre`}
                    onChange={(value) => updateMedication(index, { nombre: value })}
                    required
                    value={medicamento.nombre}
                  />
                  <TextField
                    error={visibleErrors[`receta.medicamentos.${index}.dosis`]}
                    label="Dosis"
                    name={`receta.medicamentos.${index}.dosis`}
                    onChange={(value) => updateMedication(index, { dosis: value })}
                    placeholder="Ej. 1 tableta"
                    required
                    value={medicamento.dosis}
                  />
                  <TextField
                    error={visibleErrors[`receta.medicamentos.${index}.frecuencia`]}
                    label="Frecuencia"
                    name={`receta.medicamentos.${index}.frecuencia`}
                    onChange={(value) => updateMedication(index, { frecuencia: value })}
                    placeholder="Cada 8 horas"
                    required
                    value={medicamento.frecuencia}
                  />
                  <TextField
                    error={visibleErrors[`receta.medicamentos.${index}.duracion`]}
                    label="Duracion"
                    name={`receta.medicamentos.${index}.duracion`}
                    onChange={(value) => updateMedication(index, { duracion: value })}
                    placeholder="5 dias"
                    required
                    value={medicamento.duracion}
                  />
                  <div className="flex items-end">
                    <Button
                      aria-label="Quitar medicamento"
                      onClick={() => removeMedication(index)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                  <TextField
                    error={visibleErrors[`receta.medicamentos.${index}.indicaciones`]}
                    label="Indicaciones"
                    name={`receta.medicamentos.${index}.indicaciones`}
                    onChange={(value) => updateMedication(index, { indicaciones: value })}
                    placeholder="Tomar despues de alimentos"
                    value={medicamento.indicaciones}
                  />
                  <TextField
                    error={visibleErrors[`receta.medicamentos.${index}.cantidad`]}
                    label="Cantidad"
                    name={`receta.medicamentos.${index}.cantidad`}
                    onChange={(value) => updateMedication(index, { cantidad: value })}
                    placeholder="Opcional"
                    type="number"
                    value={medicamento.cantidad}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-3xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              No se agregaron medicamentos a la receta.
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">
              Diagnosticos secundarios
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Agrega diagnosticos adicionales cuando corresponda.
            </p>
          </div>
          <Button
            onClick={() =>
              setForm((current) => ({
                ...current,
                secundarios: [...current.secundarios, emptyIcdCode],
              }))
            }
            type="button"
            variant="outline"
          >
            <PlusIcon data-icon="inline-start" />
            Agregar diagnostico
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {form.secundarios.length > 0 ? (
            form.secundarios.map((diagnostico, index) => (
              <div
                className="grid gap-3 rounded-3xl border bg-muted/30 p-3 md:grid-cols-[1fr_auto]"
                key={index}
              >
                <IcdCodePicker
                  baseName={`secundarios.${index}`}
                  error={
                    visibleErrors[`secundarios.${index}.title`] ??
                    visibleErrors[`secundarios.${index}.iNo`]
                  }
                  label={`Diagnostico secundario ${index + 1}`}
                  onChange={(value) => updateSecondary(index, value)}
                  value={diagnostico}
                />
                <div className="flex items-end">
                  <Button
                    aria-label="Quitar diagnostico"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        secundarios: current.secundarios.filter(
                          (_diagnostico, currentIndex) =>
                            currentIndex !== index,
                        ),
                      }))
                    }
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-3xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              No se agregaron diagnosticos secundarios.
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Plan de trabajo</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Registra indicaciones, conducta y seguimiento sugerido.
          </p>
        </div>
        <TextareaField
          error={visibleErrors.planTrabajo}
          label="Plan de trabajo"
          name="planTrabajo"
          onChange={(value) =>
            setForm((current) => ({ ...current, planTrabajo: value }))
          }
          required
          value={form.planTrabajo}
        />
      </section>

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-3xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ??
            "Al guardar se enviara la generacion del reporte."}
        </p>
        <Button disabled={isPending} type="submit">
          <SaveIcon data-icon="inline-start" />
          {isPending ? "Guardando..." : "Guardar diagnostico"}
        </Button>
      </footer>
      {confirmationDialog}
    </form>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function InventarioDialog({
  inventarioItems,
  onSelect,
}: {
  inventarioItems: ViajeInventarioItem[];
  onSelect: (item: ViajeInventarioItem) => void;
}) {
  const [search, setSearch] = useState("");
  const medicamentos = inventarioItems.filter(
    (item) => item.categoria === "medicamento",
  );

  const normalizedSearch = normalizeSearch(search);
  const filtered = normalizedSearch
    ? medicamentos.filter((item) => {
        const searchable = normalizeSearch(
          [
            item.nombre,
            item.principioActivo,
            item.concentracion,
            item.formaFarmaceutica,
            item.viaAdministracion,
            item.laboratorio,
          ]
            .filter(Boolean)
            .join(" "),
        );
        return searchable.includes(normalizedSearch);
      })
    : medicamentos;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <PackageSearchIcon data-icon="inline-start" />
          Usar inventario
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[86vh] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Inventario del viaje</DialogTitle>
          <DialogDescription>
            Selecciona medicamentos disponibles para agregarlos a la receta.
          </DialogDescription>
        </DialogHeader>
        <Input
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, principio activo, concentracion..."
          type="search"
          value={search}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-2">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <button
                  className="flex items-start justify-between gap-3 rounded-2xl border bg-background p-3 text-left hover:bg-muted/50"
                  key={item.id}
                  onClick={() => onSelect(item)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {item.nombre}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {[
                        item.principioActivo,
                        item.concentracion,
                        item.formaFarmaceutica,
                        item.viaAdministracion,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Sin detalle farmacologico"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.cantidadDisponible ?? item.cantidadPlanificada}{" "}
                    {item.unidad}
                  </span>
                </button>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                {medicamentos.length === 0
                  ? "No hay medicamentos en el inventario de este viaje."
                  : "No se encontraron medicamentos con esa busqueda."}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
