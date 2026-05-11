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
import { SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { TextareaField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
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
import { CreateExamenFisicoSegmentarioSchema } from "@/lib/schema/examenFisicoSegmentario";

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
    description: "Exploracion de cabeza, cuello, piel y faneras.",
    fields: [
      { label: "Cabeza", name: "cabeza" },
      { label: "Cuello", name: "cuello" },
      { label: "Piel y faneras", name: "pielFaneras" },
    ],
    title: "Inspeccion inicial",
  },
  {
    description: "Revision por aparatos y sistemas principales.",
    fields: [
      { label: "Aparato respiratorio", name: "aparatoRespiratorio" },
      { label: "Aparato cardiovascular", name: "aparatoCardiovascular" },
      { label: "Abdomen y pelvis", name: "abdomenPelvis" },
      { label: "Aparato genitourinario", name: "aparatoGenitourinario" },
    ],
    title: "Aparatos",
  },
  {
    description: "Registro de hallazgos osteoartromusculares, neurologicos y hemolinfopoyeticos.",
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
    label: "Ecografia",
    name: "ecografia",
  },
  {
    label: "Laboratorios",
    name: "laboratorios",
  },
  {
    label: "Espirometria",
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
  const [examenesComplementariosSolicitados, setExamenesComplementariosSolicitados] =
    useState<ExamenesComplementariosForm>(baseExamenesComplementarios);
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
    if (!validateForm()) {
      event.preventDefault();
      return;
    }

    if (!action) {
      event.preventDefault();
    }
  }

  function validateForm() {
    const result = CreateExamenFisicoSegmentarioSchema.safeParse(
      buildPayload(form),
    );

    if (!result.success) {
      setErrors(getErrorMap(result.error));
      return false;
    }

    setErrors({});

    return true;
  }

  function openConfirmDialog() {
    if (validateForm()) {
      setConfirmOpen(true);
    }
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
      className="flex flex-col gap-6"
      id={formId}
      onSubmit={handleSubmit}
    >
      {fieldGroups.map((group) => (
        <FormSection
          description={group.description}
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
                placeholder="Describe hallazgos normales o patologicos"
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

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-3xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ??
            "Completa los segmentos examinados para guardar."}
        </p>
        <Button disabled={isPending} onClick={openConfirmDialog} type="button">
          <SaveIcon data-icon="inline-start" />
          {isPending ? "Guardando..." : "Guardar examen segmentario"}
        </Button>
      </footer>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar examenes complementarios</DialogTitle>
            <DialogDescription>
              Marca los estudios que quedaran solicitados al guardar este
              examen segmentario.
            </DialogDescription>
          </DialogHeader>

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
