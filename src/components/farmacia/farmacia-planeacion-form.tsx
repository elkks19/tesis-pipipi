"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { ViajeInventarioTable } from "@/components/farmacia/viaje-inventario-table";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AddInventarioItemActionState } from "@/lib/farmacia-actions";
import type { ViajeInventarioItem } from "@/lib/schema";
import { CreateViajeInventarioItemSchema } from "@/lib/schema/farmacia";

type FarmaciaPlaneacionFormProps = {
  action: (
    state: AddInventarioItemActionState,
    formData: FormData,
  ) => Promise<AddInventarioItemActionState>;
  items: ViajeInventarioItem[];
};

const initialState: AddInventarioItemActionState = {
  ok: false,
};

const categorias = [
  { label: "Medicamento", value: "medicamento" },
  { label: "Insumo", value: "insumo" },
  { label: "Equipo", value: "equipo" },
  { label: "Otro", value: "otro" },
];

const emptyFields = { categoria: "medicamento", nombre: "", principioActivo: "", cantidadPlanificada: "", unidad: "", concentracion: "", formaFarmaceutica: "" };

function getError(
  errors: AddInventarioItemActionState["errors"],
  field: string,
) {
  const message = errors?.[field];

  return message ? [{ message }] : undefined;
}

export function FarmaciaPlaneacionForm({
  action,
  items,
}: FarmaciaPlaneacionFormProps) {
  const [categoria, setCategoria] = useState("medicamento");
  const [fields, setFields] = useState(emptyFields);
  const formRef = useRef<HTMLFormElement>(null);
  const resetErrorsRef = useRef<() => void>(() => {});
  const [state, formAction, isPending] = useActionState(async (previousState: AddInventarioItemActionState, data: FormData) => {
    const result = await action(previousState, data);
    if (result.ok) {
      formRef.current?.reset();
      setCategoria("medicamento");
      setFields(emptyFields);
      resetErrorsRef.current();
    }
    return result;
  }, initialState);
  const isMedication = categoria === "medicamento";
  const displayState = useMemo(() => ({ ...state, ok: false }), [state]);
  const validation = CreateViajeInventarioItemSchema.safeParse(fields);
  const { visibleErrors, onBlurCapture, revealErrors, resetErrors } = useInteractiveErrors({
    value: fields, actionState: displayState, isPending,
    validationError: validation.success ? undefined : validation.error,
  });
  useEffect(() => {
    resetErrorsRef.current = resetErrors;
  }, [resetErrors]);

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
      return;
    }

    toast.error(state.message);
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Agregar al inventario</CardTitle>
          <CardDescription>
            Registra medicamentos e insumos que se llevaran al viaje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} className="flex flex-col gap-4" noValidate
            onBlurCapture={onBlurCapture}
            onChangeCapture={(event) => {
              const target = event.nativeEvent.target;
              if (target instanceof HTMLInputElement && target.name in emptyFields) {
                setFields((current) => ({ ...current, [target.name]: target.value }));
              }
            }}
            onSubmit={(event) => { revealErrors(event); }}>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr_1fr_100px_100px]">
                <Field data-invalid={Boolean(visibleErrors.categoria)}>
                  <FieldLabel htmlFor="categoria">Tipo</FieldLabel>
                  <Select
                    name="categoria"
                    onValueChange={(value) => { setCategoria(value); setFields((current) => ({ ...current, categoria: value })); }}
                    value={categoria}
                  >
                    <SelectTrigger aria-invalid={Boolean(visibleErrors.categoria)} aria-describedby={visibleErrors.categoria ? "categoria-error" : undefined} className="w-full" id="categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categorias.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError id="categoria-error" errors={getError(visibleErrors, "categoria")} />
                </Field>

                <Field data-invalid={Boolean(visibleErrors.nombre)}>
                  <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
                  <Input
                    aria-invalid={Boolean(visibleErrors.nombre)}
                    aria-describedby={visibleErrors.nombre ? "nombre-error" : undefined}
                    id="nombre"
                    name="nombre"
                    placeholder={isMedication ? "Ej. Paracetamol 500mg tabletas" : "Ej. Gasa esteril"}
                  />
                  <FieldError id="nombre-error" errors={getError(visibleErrors, "nombre")} />
                </Field>

                {isMedication ? (
                  <Field data-invalid={Boolean(visibleErrors.principioActivo)}>
                    <FieldLabel htmlFor="principioActivo">Principio activo</FieldLabel>
                    <Input
                      aria-invalid={Boolean(visibleErrors.principioActivo)}
                      aria-describedby={visibleErrors.principioActivo ? "principioActivo-error" : undefined}
                      id="principioActivo"
                      name="principioActivo"
                      placeholder="Ej. Paracetamol"
                    />
                    <FieldError id="principioActivo-error" errors={getError(visibleErrors, "principioActivo")} />
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="observaciones">Observaciones</FieldLabel>
                    <Input
                      id="observaciones"
                      name="observaciones"
                      placeholder="Notas opcionales"
                    />
                  </Field>
                )}

                <Field data-invalid={Boolean(visibleErrors.cantidadPlanificada)}>
                  <FieldLabel htmlFor="cantidadPlanificada">Cantidad</FieldLabel>
                  <Input
                    aria-invalid={Boolean(visibleErrors.cantidadPlanificada)}
                    aria-describedby={visibleErrors.cantidadPlanificada ? "cantidadPlanificada-error" : undefined}
                    id="cantidadPlanificada"
                    min="0"
                    name="cantidadPlanificada"
                    placeholder="0"
                    step="1"
                    type="number"
                  />
                  <FieldError id="cantidadPlanificada-error" errors={getError(visibleErrors, "cantidadPlanificada")} />
                </Field>

                <Field data-invalid={Boolean(visibleErrors.unidad)}>
                  <FieldLabel htmlFor="unidad">Unidad</FieldLabel>
                  <Input
                    aria-invalid={Boolean(visibleErrors.unidad)}
                    aria-describedby={visibleErrors.unidad ? "unidad-error" : undefined}
                    id="unidad"
                    name="unidad"
                    placeholder="cajas"
                  />
                  <FieldError id="unidad-error" errors={getError(visibleErrors, "unidad")} />
                </Field>
              </div>

              {isMedication && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <Field data-invalid={Boolean(visibleErrors.concentracion)}>
                    <FieldLabel htmlFor="concentracion">Concentracion</FieldLabel>
                    <Input
                      aria-invalid={Boolean(visibleErrors.concentracion)}
                      aria-describedby={visibleErrors.concentracion ? "concentracion-error" : undefined}
                      id="concentracion"
                      name="concentracion"
                      placeholder="500 mg"
                    />
                    <FieldError id="concentracion-error" errors={getError(visibleErrors, "concentracion")} />
                  </Field>
                  <Field data-invalid={Boolean(visibleErrors.formaFarmaceutica)}>
                    <FieldLabel htmlFor="formaFarmaceutica">Forma</FieldLabel>
                    <Input
                      aria-invalid={Boolean(visibleErrors.formaFarmaceutica)}
                      aria-describedby={visibleErrors.formaFarmaceutica ? "formaFarmaceutica-error" : undefined}
                      id="formaFarmaceutica"
                      name="formaFarmaceutica"
                      placeholder="Tableta"
                    />
                    <FieldError id="formaFarmaceutica-error" errors={getError(visibleErrors, "formaFarmaceutica")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="viaAdministracion">Via</FieldLabel>
                    <Input
                      id="viaAdministracion"
                      name="viaAdministracion"
                      placeholder="Oral"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="laboratorio">Laboratorio</FieldLabel>
                    <Input
                      id="laboratorio"
                      name="laboratorio"
                      placeholder="Opcional"
                    />
                  </Field>
                  <input name="fuente" type="hidden" value="manual" />
                </div>
              )}

              {!isMedication && (
                <input name="fuente" type="hidden" value="manual" />
              )}
            </FieldGroup>

            <div className="flex justify-end">
              <Button disabled={isPending} size="sm" type="submit">
                <PlusIcon className="size-4" />
                {isPending ? "Guardando..." : "Agregar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Inventario planificado</CardTitle>
          <CardDescription>
            {items.length} items registrados para el viaje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ViajeInventarioTable items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
