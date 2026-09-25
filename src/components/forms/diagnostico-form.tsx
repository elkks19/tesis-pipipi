"use client";

import {
  type FormEvent,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, ClipboardListIcon, FileCheck2Icon, PackageSearchIcon, PillIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { firstFieldErrors } from "@/lib/schema/field-errors";

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

const formSteps = [
  { id: "principal", label: "Diagnóstico principal", prefixes: ["principal"] },
  { id: "secundarios", label: "Diagnósticos adicionales", prefixes: ["secundarios"] },
  { id: "plan", label: "Plan de trabajo", prefixes: ["planTrabajo"] },
  { id: "receta", label: "Receta", prefixes: ["receta"] },
] as const;

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
  const [activeStep, setActiveStep] = useState(0);
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: "Guardar diagnóstico",
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
      document.getElementById(`diagnostico-${formSteps[index].id}-title`)?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
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
      className="grid scroll-mt-20 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6"
      noValidate
      onBlurCapture={onBlurCapture}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <input name="historiaId" type="hidden" value={form.historiaId} />
      <input name="recetaId" type="hidden" value={form.recetaId} />

      <nav aria-label="Pasos del diagnóstico" className="rounded-xl border bg-muted/20 p-3 lg:sticky lg:top-20">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Para cerrar la historia</p>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {formSteps.map((step, index) => {
            const errorCount = Object.keys(visibleErrors).filter((path) =>
              step.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`)),
            ).length;
            return (
              <li className="shrink-0 lg:shrink" key={step.id}>
                <button
                  aria-controls={`diagnostico-${step.id}`}
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

      <section className="overflow-hidden rounded-xl border bg-background shadow-sm" hidden={activeStep !== 0} id="diagnostico-principal">
        <StepHeader description="Selecciona el diagnóstico principal usando la búsqueda CIE-11." id="principal" title="Diagnóstico principal" />
        <div className="p-4 sm:p-6">
        <IcdCodePicker
          baseName="principal"
          error={
            visibleErrors["principal.title"] ??
            visibleErrors["principal.iNo"] ??
            visibleErrors.principal
          }
          label="Diagnóstico CIE-11"
          onChange={(value) =>
            setForm((current) => ({ ...current, principal: value }))
          }
          value={form.principal}
        />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-background shadow-sm" hidden={activeStep !== 3} id="diagnostico-receta">
        <StepHeader description="Indica el tratamiento y agrega medicamentos del inventario o de forma manual." id="receta" title="Receta" />
        <div className="flex flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                className="grid gap-3 rounded-xl border bg-muted/20 p-4"
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
            <p className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              No se agregaron medicamentos a la receta.
            </p>
          )}
        </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-background shadow-sm" hidden={activeStep !== 1} id="diagnostico-secundarios">
        <StepHeader description="Agrega diagnósticos adicionales cuando corresponda." id="secundarios" title="Diagnósticos adicionales" />
        <div className="flex flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
            Agregar diagnóstico
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {form.secundarios.length > 0 ? (
            form.secundarios.map((diagnostico, index) => (
              <div
                className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[1fr_auto]"
                key={index}
              >
                <IcdCodePicker
                  baseName={`secundarios.${index}`}
                  error={
                    visibleErrors[`secundarios.${index}.title`] ??
                    visibleErrors[`secundarios.${index}.iNo`]
                  }
                  label={`Diagnóstico adicional ${index + 1}`}
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
            <p className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              No se agregaron diagnósticos adicionales.
            </p>
          )}
        </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-background shadow-sm" hidden={activeStep !== 2} id="diagnostico-plan">
        <StepHeader description="Registra la conducta clínica, indicaciones y seguimiento sugerido." id="plan" title="Plan de trabajo" />
        <div className="p-4 sm:p-6">
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
        </div>
      </section>

      <footer className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? (activeStep === formSteps.length - 1 ? "Revisa los datos antes de guardar y generar el reporte." : "Continúa al siguiente apartado cuando termines.")}
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button disabled={isPending || activeStep === 0} onClick={() => goToStep(activeStep - 1)} type="button" variant="outline"><ArrowLeftIcon data-icon="inline-start" />Anterior</Button>
          {activeStep < formSteps.length - 1 ? (
            <Button disabled={isPending} onClick={() => goToStep(activeStep + 1)} type="button">Siguiente<ArrowRightIcon data-icon="inline-end" /></Button>
          ) : (
            <Button disabled={isPending} type="submit"><SaveIcon data-icon="inline-start" />{isPending ? "Guardando..." : "Guardar diagnóstico"}</Button>
          )}
        </div>
      </footer>
      </div>
      {confirmationDialog}
    </form>
  );
}

function StepHeader({ description, id, title }: { description: string; id: string; title: string }) {
  const index = formSteps.findIndex((step) => step.id === id);
  const Icon = id === "receta" ? PillIcon : id === "plan" ? ClipboardListIcon : FileCheck2Icon;
  return (
    <div className="flex items-start gap-3 border-b bg-muted/20 p-4 sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Apartado {String(index + 1).padStart(2, "0")}</p>
        <h2 className="text-base font-semibold" id={`diagnostico-${id}-title`} tabIndex={-1}>{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
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
