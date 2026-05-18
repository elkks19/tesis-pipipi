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

import { SelectField, TextField } from "@/components/forms/fields";
import {
  listSummary,
  textSummary,
  useSubmitConfirmation,
} from "@/components/forms/submit-confirmation";
import { Button } from "@/components/ui/button";
import {
  CreateLaboratoriosSchema,
  gruposSanguineos,
} from "@/lib/schema/laboratorios";

type Emptyable<T extends string> = T | "";

type OtroEstudioValue = {
  nombre: string;
  resultado: string;
};

export type LaboratoriosFormValue = {
  glicemiaCapilar: string;
  grupoSanguineo: Emptyable<(typeof gruposSanguineos)[number]>;
  otrosEstudios: OtroEstudioValue[];
};

type LaboratoriosActionState = {
  errors?: Record<string, string>;
  message?: string;
  ok: boolean;
};

type LaboratoriosAction = (
  previousState: LaboratoriosActionState,
  formData: FormData,
) => Promise<LaboratoriosActionState>;

type LaboratoriosFormProps = {
  action?: LaboratoriosAction;
  defaultValue?: Partial<LaboratoriosFormValue>;
  successRedirectHref?: string;
};

const baseFormValue: LaboratoriosFormValue = {
  glicemiaCapilar: "",
  grupoSanguineo: "",
  otrosEstudios: [],
};

async function noopAction(): Promise<LaboratoriosActionState> {
  return { ok: false };
}

function buildPayload(state: LaboratoriosFormValue) {
  const otrosEstudios = state.otrosEstudios
    .map((estudio) => ({
      nombre: estudio.nombre.trim(),
      resultado: estudio.resultado.trim(),
    }))
    .filter((estudio) => estudio.nombre || estudio.resultado);

  return {
    glicemiaCapilar: state.glicemiaCapilar.trim(),
    grupoSanguineo: state.grupoSanguineo,
    ...(otrosEstudios.length > 0 ? { otrosEstudios } : {}),
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

function createInitialValue(defaultValue?: Partial<LaboratoriosFormValue>) {
  return {
    ...baseFormValue,
    ...defaultValue,
    otrosEstudios: defaultValue?.otrosEstudios ?? [],
  };
}

function getConfirmationSections(form: LaboratoriosFormValue) {
  return [
    {
      title: "Resultados base",
      items: [
        { label: "Glicemia capilar", value: textSummary(form.glicemiaCapilar) },
        { label: "Grupo sanguineo", value: textSummary(form.grupoSanguineo) },
      ],
    },
    {
      title: "Otros estudios",
      items: [
        {
          label: "Estudios registrados",
          value: listSummary(
            form.otrosEstudios
              .filter((estudio) => estudio.nombre || estudio.resultado)
              .map((estudio) => `${estudio.nombre}: ${estudio.resultado}`),
          ),
        },
      ],
    },
  ];
}

export function LaboratoriosForm({
  action,
  defaultValue,
  successRedirectHref,
}: LaboratoriosFormProps) {
  const router = useRouter();
  const initialValue = useMemo(
    () => createInitialValue(defaultValue),
    [defaultValue],
  );
  const [form, setForm] = useState<LaboratoriosFormValue>(initialValue);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionState, formAction, isPending] = useActionState(
    action ?? noopAction,
    { ok: false },
  );
  const { confirmationDialog, confirmSubmit, formRef } =
    useSubmitConfirmation({
      actionAvailable: Boolean(action),
      confirmLabel: "Guardar laboratorios",
    });
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
    const result = CreateLaboratoriosSchema.safeParse(buildPayload(form));

    if (!result.success) {
      event.preventDefault();
      setErrors(getErrorMap(result.error));
      return;
    }

    setErrors({});

    if (!confirmSubmit(event, getConfirmationSections(form))) {
      return;
    }
  }

  function updateStudy(index: number, patch: Partial<OtroEstudioValue>) {
    setForm((current) => ({
      ...current,
      otrosEstudios: current.otrosEstudios.map((estudio, currentIndex) =>
        currentIndex === index ? { ...estudio, ...patch } : estudio,
      ),
    }));
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6"
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <section className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Resultados base</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Registra glicemia capilar, grupo sanguineo y estudios adicionales
            solicitados durante la atencion.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            error={visibleErrors.glicemiaCapilar}
            label="Glicemia capilar"
            name="glicemiaCapilar"
            onChange={(value) =>
              setForm((current) => ({ ...current, glicemiaCapilar: value }))
            }
            required
            value={form.glicemiaCapilar}
          />
          <SelectField
            error={visibleErrors.grupoSanguineo}
            label="Grupo sanguineo"
            name="grupoSanguineo"
            onChange={(value) =>
              setForm((current) => ({ ...current, grupoSanguineo: value }))
            }
            options={gruposSanguineos}
            required
            value={form.grupoSanguineo}
          />
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Otros estudios</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Agrega estudios complementarios con su resultado si corresponde.
            </p>
          </div>
          <Button
            onClick={() =>
              setForm((current) => ({
                ...current,
                otrosEstudios: [
                  ...current.otrosEstudios,
                  { nombre: "", resultado: "" },
                ],
              }))
            }
            type="button"
            variant="outline"
          >
            <PlusIcon data-icon="inline-start" />
            Agregar estudio
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {form.otrosEstudios.length > 0 ? (
            form.otrosEstudios.map((estudio, index) => (
              <div
                className="grid gap-3 rounded-3xl border bg-muted/30 p-3 md:grid-cols-[1fr_1fr_auto]"
                key={index}
              >
                <TextField
                  error={visibleErrors[`otrosEstudios.${index}.nombre`]}
                  label="Nombre"
                  name={`otrosEstudios.${index}.nombre`}
                  onChange={(value) => updateStudy(index, { nombre: value })}
                  value={estudio.nombre}
                />
                <TextField
                  error={visibleErrors[`otrosEstudios.${index}.resultado`]}
                  label="Resultado"
                  name={`otrosEstudios.${index}.resultado`}
                  onChange={(value) => updateStudy(index, { resultado: value })}
                  value={estudio.resultado}
                />
                <div className="flex items-end">
                  <Button
                    aria-label="Quitar estudio"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        otrosEstudios: current.otrosEstudios.filter(
                          (_study, currentIndex) => currentIndex !== index,
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
              No se agregaron otros estudios.
            </p>
          )}
        </div>
      </section>

      <footer className="sticky bottom-0 flex flex-col gap-3 rounded-3xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {actionState.message ?? "Completa los resultados para guardar."}
        </p>
        <Button disabled={isPending} type="submit">
          <SaveIcon data-icon="inline-start" />
          {isPending ? "Guardando..." : "Guardar laboratorios"}
        </Button>
      </footer>
      {confirmationDialog}
    </form>
  );
}
