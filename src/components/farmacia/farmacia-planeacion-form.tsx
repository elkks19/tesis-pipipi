"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { ViajeInventarioTable } from "@/components/farmacia/viaje-inventario-table";
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
import { Textarea } from "@/components/ui/textarea";
import type { AddInventarioItemActionState } from "@/lib/farmacia-actions";
import type { ViajeInventarioItem } from "@/lib/schema";

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
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [categoria, setCategoria] = useState("medicamento");
  const formRef = useRef<HTMLFormElement>(null);
  const isMedication = categoria === "medicamento";

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
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
          <form ref={formRef} action={formAction} className="flex flex-col gap-4">
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr_1fr_100px_100px]">
                <Field data-invalid={Boolean(state.errors?.categoria)}>
                  <FieldLabel htmlFor="categoria">Tipo</FieldLabel>
                  <Select
                    name="categoria"
                    onValueChange={setCategoria}
                    value={categoria}
                  >
                    <SelectTrigger className="w-full" id="categoria">
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
                  <FieldError errors={getError(state.errors, "categoria")} />
                </Field>

                <Field data-invalid={Boolean(state.errors?.nombre)}>
                  <FieldLabel htmlFor="nombre">Nombre</FieldLabel>
                  <Input
                    id="nombre"
                    name="nombre"
                    placeholder={isMedication ? "Ej. Paracetamol 500mg tabletas" : "Ej. Gasa esteril"}
                  />
                  <FieldError errors={getError(state.errors, "nombre")} />
                </Field>

                {isMedication ? (
                  <Field data-invalid={Boolean(state.errors?.principioActivo)}>
                    <FieldLabel htmlFor="principioActivo">Principio activo</FieldLabel>
                    <Input
                      id="principioActivo"
                      name="principioActivo"
                      placeholder="Ej. Paracetamol"
                    />
                    <FieldError errors={getError(state.errors, "principioActivo")} />
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

                <Field data-invalid={Boolean(state.errors?.cantidadPlanificada)}>
                  <FieldLabel htmlFor="cantidadPlanificada">Cantidad</FieldLabel>
                  <Input
                    id="cantidadPlanificada"
                    min="0"
                    name="cantidadPlanificada"
                    placeholder="0"
                    step="1"
                    type="number"
                  />
                  <FieldError errors={getError(state.errors, "cantidadPlanificada")} />
                </Field>

                <Field data-invalid={Boolean(state.errors?.unidad)}>
                  <FieldLabel htmlFor="unidad">Unidad</FieldLabel>
                  <Input
                    id="unidad"
                    name="unidad"
                    placeholder="cajas"
                  />
                  <FieldError errors={getError(state.errors, "unidad")} />
                </Field>
              </div>

              {isMedication && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <Field data-invalid={Boolean(state.errors?.concentracion)}>
                    <FieldLabel htmlFor="concentracion">Concentracion</FieldLabel>
                    <Input
                      id="concentracion"
                      name="concentracion"
                      placeholder="500 mg"
                    />
                    <FieldError errors={getError(state.errors, "concentracion")} />
                  </Field>
                  <Field data-invalid={Boolean(state.errors?.formaFarmaceutica)}>
                    <FieldLabel htmlFor="formaFarmaceutica">Forma</FieldLabel>
                    <Input
                      id="formaFarmaceutica"
                      name="formaFarmaceutica"
                      placeholder="Tableta"
                    />
                    <FieldError errors={getError(state.errors, "formaFarmaceutica")} />
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
