"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { ActivityIcon, ArrowLeftIcon, ArrowRightIcon, SaveIcon, ScanSearchIcon, StethoscopeIcon } from "lucide-react";
import { toast } from "sonner";

import { TextareaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreateExamenFisicoSegmentarioSchema } from "@/lib/schema/examenFisicoSegmentario";
import { cn } from "@/lib/utils";

export type ExamenFisicoSegmentarioFormValue = {
  abdomenPelvis: string;
  aparatoCardiovascular: string;
  aparatoGenitourinario: string;
  aparatoOsteoartromuscular: string;
  aparatoRespiratorio: string;
  cabeza: string;
  cuello: string;
  pielFaneras: string;
  sistemaHemolinfopoyetico: string;
  sistemaNerviosoCentral: string;
};

type ExamenFisicoSegmentarioActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type ExamenFisicoSegmentarioAction = (
  previousState: ExamenFisicoSegmentarioActionState,
  formData: FormData,
) => Promise<ExamenFisicoSegmentarioActionState>;

type ExamenFisicoSegmentarioFormProps = {
  action?: ExamenFisicoSegmentarioAction;
  defaultValue?: Partial<ExamenFisicoSegmentarioFormValue>;
  successRedirectHref?: string;
};

type ExamenesComplementariosForm = {
  ecografia: boolean;
  laboratorios: boolean;
  espirometria: boolean;
  electrocardiograma: boolean;
};

const baseFormValue: ExamenFisicoSegmentarioFormValue = {
  abdomenPelvis: "",
  aparatoCardiovascular: "",
  aparatoGenitourinario: "",
  aparatoOsteoartromuscular: "",
  aparatoRespiratorio: "",
  cabeza: "",
  cuello: "",
  pielFaneras: "",
  sistemaHemolinfopoyetico: "",
  sistemaNerviosoCentral: "",
};

const fieldGroups = [
  {
    description: "Exploración de cabeza, cuello, piel y faneras.",
    fields: [
      { label: "Cabeza", name: "cabeza" },
      { label: "Cuello", name: "cuello" },
      { label: "Piel y faneras", name: "pielFaneras" },
    ],
    title: "Inspección inicial",
  },
  {
    description: "Revisión por aparatos y sistemas principales.",
    fields: [
      { label: "Aparato respiratorio", name: "aparatoRespiratorio" },
      { label: "Aparato cardiovascular", name: "aparatoCardiovascular" },
      { label: "Abdomen y pelvis", name: "abdomenPelvis" },
      { label: "Aparato genitourinario", name: "aparatoGenitourinario" },
    ],
    title: "Aparatos",
  },
  {
    description: "Registro de hallazgos osteoartromusculares, neurológicos y hemolinfopoyéticos.",
    fields: [
      {
        label: "Sistema hemolinfopoyetico",
        name: "sistemaHemolinfopoyetico",
      },
      {
        label: "Aparato osteoartromuscular",
        name: "aparatoOsteoartromuscular",
      },
      {
        label: "Sistema nervioso central",
        name: "sistemaNerviosoCentral",
      },
    ],
    title: "Sistemas",
  },
] as const;

const examenesComplementarios = [
  {
    label: "Ecografía",
    name: "ecografia",
  },
  {
    label: "Laboratorios",
    name: "laboratorios",
  },
  {
    label: "Espirometría",
    name: "espirometria",
  },
  {
    label: "Electrocardiograma",
    name: "electrocardiograma",
  },
] as const;

const baseExamenesComplementarios: ExamenesComplementariosForm = {
  ecografia: false,
  laboratorios: false,
  espirometria: false,
  electrocardiograma: false,
};

async function noopAction(): Promise<ExamenFisicoSegmentarioActionState> {
  return { ok: false };
}

function buildPayload(state: ExamenFisicoSegmentarioFormValue) {
  return {
    abdomenPelvis: state.abdomenPelvis.trim(),
    aparatoCardiovascular: state.aparatoCardiovascular.trim(),
    aparatoGenitourinario: state.aparatoGenitourinario.trim(),
    aparatoOsteoartromuscular: state.aparatoOsteoartromuscular.trim(),
    aparatoRespiratorio: state.aparatoRespiratorio.trim(),
    cabeza: state.cabeza.trim(),
    cuello: state.cuello.trim(),
    pielFaneras: state.pielFaneras.trim(),
    sistemaHemolinfopoyetico: state.sistemaHemolinfopoyetico.trim(),
    sistemaNerviosoCentral: state.sistemaNerviosoCentral.trim(),
  };
}

function createInitialValue(
  defaultValue?: Partial<ExamenFisicoSegmentarioFormValue>,
) {
  return {
    ...baseFormValue,
    ...defaultValue,
  };
}

export function ExamenFisicoSegmentarioForm({
  action,
  defaultValue,
  successRedirectHref,
}: ExamenFisicoSegmentarioFormProps) {
  const router = useRouter();
  const formId = useId();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] =
    useState<ExamenFisicoSegmentarioFormValue>(initialValue);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [examenesComplementariosSolicitados, setExamenesComplementariosSolicitados] =
    useState<ExamenesComplementariosForm>(baseExamenesComplementarios);
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const validation = CreateExamenFisicoSegmentarioSchema.safeParse(buildPayload(form));
  const { visibleErrors, onBlurCapture, revealErrors, showAllErrors } = useInteractiveErrors({
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

  function updateField(
    name: keyof ExamenFisicoSegmentarioFormValue,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (revealErrors(event)) {
      return;
    }

    if (!action) {
      event.preventDefault();
    }
  }

  function openConfirmDialog() {
    showAllErrors();
    if (validation.success) {
      setConfirmOpen(true);
    } else {
      const firstField = validation.error.issues[0]?.path[0];
      const errorStep = fieldGroups.findIndex((group) =>
        group.fields.some((field) => field.name === firstField),
      );
      if (errorStep >= 0) goToStep(errorStep);
    }
  }

  function goToStep(index: number) {
    setActiveStep(index);
    window.requestAnimationFrame(() => {
      document.getElementById(`segmentario-${index}-title`)?.focus({ preventScroll: true });
      document.getElementById(formId)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function updateExamenComplementario(
    name: keyof ExamenesComplementariosForm,
    checked: boolean,
  ) {
    setExamenesComplementariosSolicitados((current) => ({
      ...current,
      [name]: checked,
    }));
  }

  return (
    <form
      action={formAction}
      className="grid scroll-mt-20 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6"
      id={formId}
      noValidate
      onBlurCapture={onBlurCapture}
      onSubmit={handleSubmit}
    >
      <nav aria-label="Pasos del examen físico" className="rounded-xl border bg-muted/20 p-3 lg:sticky lg:top-20">
        <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">En este examen</p>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {fieldGroups.map((group, index) => (
            <li className="shrink-0 lg:shrink" key={group.title}>
              <button aria-controls={`segmentario-${index}`} aria-current={activeStep === index ? "step" : undefined}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring", activeStep === index && "bg-accent font-semibold text-accent-foreground")}
                disabled={isPending} onClick={() => goToStep(index)} type="button">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums text-muted-foreground", activeStep === index && "border-primary bg-primary text-primary-foreground")}>{String(index + 1).padStart(2, "0")}</span>
                <span>{group.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="hidden px-2 pt-4 text-xs leading-relaxed text-muted-foreground lg:block">Puedes cambiar de paso sin perder lo escrito. Guarda al finalizar.</p>
      </nav>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p aria-live="polite">Paso {activeStep + 1} de {fieldGroups.length} · {fieldGroups[activeStep].title}</p>
            <p>* Campos obligatorios</p>
          </div>
          <div aria-hidden="true" className="flex gap-1.5">
            {fieldGroups.map((group, index) => <span className={cn("h-1 flex-1 rounded-full bg-muted", index <= activeStep && "bg-primary")} key={group.title} />)}
          </div>
        </div>
      {fieldGroups.map((group, index) => (
        <FormSection
          description={group.description}
          hidden={activeStep !== index}
          index={index}
          key={group.title}
          title={group.title}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {group.fields.map((field) => (
              <TextareaField
                className="min-h-32"
                error={visibleErrors[field.name]}
                key={field.name}
                label={field.label}
                name={field.name}
                onChange={(value) => updateField(field.name, value)}
                placeholder="Describe hallazgos normales o patológicos"
                required
                value={form[field.name]}
              />
            ))}
          </div>
        </FormSection>
      ))}

      {examenesComplementarios.map((examen) =>
        examenesComplementariosSolicitados[examen.name] ? (
          <input
            key={examen.name}
            name={`examenesComplementariosSolicitados.${examen.name}`}
            type="hidden"
            value="true"
          />
        ) : null,
      )}

      <footer className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ??
            "Completa los segmentos examinados para guardar."}
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button disabled={isPending || activeStep === 0} onClick={() => goToStep(activeStep - 1)} type="button" variant="outline"><ArrowLeftIcon data-icon="inline-start" />Anterior</Button>
          {activeStep < fieldGroups.length - 1 ? (
            <Button disabled={isPending} onClick={() => goToStep(activeStep + 1)} type="button">Siguiente<ArrowRightIcon data-icon="inline-end" /></Button>
          ) : (
            <Button disabled={isPending} onClick={openConfirmDialog} type="button"><SaveIcon data-icon="inline-start" />Revisar y guardar</Button>
          )}
        </div>
      </footer>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Confirmar examen segmentario</DialogTitle>
            <DialogDescription>
              Revisa el resumen y marca los estudios complementarios que
              quedarán solicitados al guardar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {fieldGroups.map((group, index) => (
              <section className="overflow-hidden rounded-xl border" key={group.title}>
                <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-3"><span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span><h3 className="text-sm font-semibold">{group.title}</h3></div>
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  {group.fields.map((field) => (
                    <div
                      className="min-w-0 rounded-lg border bg-muted/20 p-3"
                      key={field.name}
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {field.label}
                      </span>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {form[field.name].trim() || "Sin información"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              Exámenes complementarios solicitados
            </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {examenesComplementarios.map((examen) => (
              <CheckboxField
                checked={examenesComplementariosSolicitados[examen.name]}
                key={examen.name}
                label={examen.label}
                onChange={(checked) =>
                  updateExamenComplementario(examen.name, checked)
                }
              />
            ))}
          </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={isPending} type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button disabled={isPending} form={formId} type="submit">
              <SaveIcon data-icon="inline-start" />
              {isPending ? "Guardando..." : "Confirmar y guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function CheckboxField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-2xl border bg-background px-3 py-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(nextValue) => onChange(nextValue === true)}
      />
      <Label>{label}</Label>
    </div>
  );
}

function FormSection({
  children,
  description,
  hidden,
  index,
  title,
}: {
  children: ReactNode;
  description: string;
  hidden: boolean;
  index: number;
  title: string;
}) {
  const Icon = [ScanSearchIcon, StethoscopeIcon, ActivityIcon][index];
  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm" hidden={hidden} id={`segmentario-${index}`}>
      <div className="flex items-start gap-3 border-b bg-muted/20 p-4 sm:p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></div>
        <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Apartado {String(index + 1).padStart(2, "0")}</span>
        <h2 className="text-base font-semibold" id={`segmentario-${index}-title`} tabIndex={-1}>{title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
