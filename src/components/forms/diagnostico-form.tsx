"use client";

import {
  type FormEvent,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  IcdCodePicker,
  type IcdCodeValue,
  TextareaField,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { CreateDiagnosticoSchema } from "@/lib/schema/diagnostico";

export type DiagnosticoFormValue = {
  historiaId: string;
  planTrabajo: string;
  principal: IcdCodeValue;
  recetaId: string;
  secundarios: IcdCodeValue[];
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
  successRedirectHref?: string;
};

const emptyIcdCode: IcdCodeValue = {
  code: "",
  iNo: "",
  title: "",
};

const baseFormValue: DiagnosticoFormValue = {
  historiaId: "",
  planTrabajo: "",
  principal: emptyIcdCode,
  recetaId: "",
  secundarios: [],
};

async function noopAction(): Promise<DiagnosticoActionState> {
  return { ok: false };
}

function buildPayload(state: DiagnosticoFormValue) {
  return {
    historiaId: state.historiaId,
    principal: state.principal,
    secundarios: state.secundarios.filter((diagnostico) => diagnostico.iNo),
    planTrabajo: state.planTrabajo.trim(),
    ...(state.recetaId.trim() ? { recetaId: state.recetaId.trim() } : {}),
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

function createInitialValue(defaultValue?: Partial<DiagnosticoFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
    principal: {
      ...emptyIcdCode,
      ...defaultValue?.principal,
    },
    secundarios: defaultValue?.secundarios ?? [],
  };
}

export function DiagnosticoForm({
  action,
  defaultValue,
  successRedirectHref,
}: DiagnosticoFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<DiagnosticoFormValue>(initialValue);
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
    const result = CreateDiagnosticoSchema.safeParse(buildPayload(form));

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

  function updateSecondary(index: number, value: IcdCodeValue) {
    setForm((current) => ({
      ...current,
      secundarios: current.secundarios.map((diagnostico, currentIndex) =>
        currentIndex === index ? value : diagnostico,
      ),
    }));
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6"
      onSubmit={handleSubmit}
    >
      <input name="historiaId" type="hidden" value={form.historiaId} />

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
        <TextField
          error={visibleErrors.recetaId}
          label="Receta relacionada"
          name="recetaId"
          onChange={(value) =>
            setForm((current) => ({ ...current, recetaId: value }))
          }
          placeholder="Opcional"
          value={form.recetaId}
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
    </form>
  );
}
