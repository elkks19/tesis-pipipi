"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  PackagePlusIcon,
  PillIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

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
  FieldDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function formatCantidad(item: ViajeInventarioItem) {
  const disponible =
    typeof item.cantidadDisponible === "number"
      ? item.cantidadDisponible
      : item.cantidadPlanificada;

  return `${disponible}/${item.cantidadPlanificada} ${item.unidad}`;
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
    <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.2fr)]">
      <Card className="h-fit" size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlusIcon />
            Planear inventario
          </CardTitle>
          <CardDescription>
            Registra lo que se llevara al viaje. Los medicamentos se guardan
            con datos tipo AGEMED para reutilizarlos sin depender de internet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} className="flex flex-col gap-6">
            <FieldGroup>
              <Field data-invalid={Boolean(state.errors?.categoria)}>
                <FieldLabel htmlFor="categoria">Tipo</FieldLabel>
                <Select
                  name="categoria"
                  onValueChange={setCategoria}
                  value={categoria}
                >
                  <SelectTrigger
                    aria-invalid={Boolean(state.errors?.categoria)}
                    className="w-full"
                    id="categoria"
                  >
                    <SelectValue placeholder="Selecciona un tipo" />
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
                <FieldLabel htmlFor="nombre">Nombre visible</FieldLabel>
                <Input
                  aria-invalid={Boolean(state.errors?.nombre)}
                  id="nombre"
                  name="nombre"
                  placeholder="Ej. Paracetamol 500 mg tabletas"
                />
                <FieldDescription>
                  En medicamentos, el nombre final se normaliza con principio
                  activo, concentracion y forma.
                </FieldDescription>
                <FieldError errors={getError(state.errors, "nombre")} />
              </Field>

              {isMedication ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field data-invalid={Boolean(state.errors?.principioActivo)}>
                    <FieldLabel htmlFor="principioActivo">
                      Principio activo
                    </FieldLabel>
                    <Input
                      aria-invalid={Boolean(state.errors?.principioActivo)}
                      id="principioActivo"
                      name="principioActivo"
                      placeholder="Ej. Paracetamol"
                    />
                    <FieldError
                      errors={getError(state.errors, "principioActivo")}
                    />
                  </Field>
                  <Field data-invalid={Boolean(state.errors?.concentracion)}>
                    <FieldLabel htmlFor="concentracion">Concentracion</FieldLabel>
                    <Input
                      aria-invalid={Boolean(state.errors?.concentracion)}
                      id="concentracion"
                      name="concentracion"
                      placeholder="Ej. 500 mg"
                    />
                    <FieldError
                      errors={getError(state.errors, "concentracion")}
                    />
                  </Field>
                  <Field data-invalid={Boolean(state.errors?.formaFarmaceutica)}>
                    <FieldLabel htmlFor="formaFarmaceutica">
                      Forma farmaceutica
                    </FieldLabel>
                    <Input
                      aria-invalid={Boolean(state.errors?.formaFarmaceutica)}
                      id="formaFarmaceutica"
                      name="formaFarmaceutica"
                      placeholder="Ej. Tableta"
                    />
                    <FieldError
                      errors={getError(state.errors, "formaFarmaceutica")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="viaAdministracion">Via</FieldLabel>
                    <Input
                      id="viaAdministracion"
                      name="viaAdministracion"
                      placeholder="Ej. Oral"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="registroSanitario">
                      Registro sanitario
                    </FieldLabel>
                    <Input
                      id="registroSanitario"
                      name="registroSanitario"
                      placeholder="AGEMED"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="laboratorio">
                      Laboratorio / titular
                    </FieldLabel>
                    <Input
                      id="laboratorio"
                      name="laboratorio"
                      placeholder="Laboratorio local"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="nombreComercial">
                      Nombre comercial
                    </FieldLabel>
                    <Input
                      id="nombreComercial"
                      name="nombreComercial"
                      placeholder="Opcional"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="atcCode">Codigo ATC</FieldLabel>
                    <Input id="atcCode" name="atcCode" placeholder="Opcional" />
                  </Field>
                  <input name="fuente" type="hidden" value="agemed" />
                </div>
              ) : (
                <input name="fuente" type="hidden" value="manual" />
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field data-invalid={Boolean(state.errors?.cantidadPlanificada)}>
                  <FieldLabel htmlFor="cantidadPlanificada">Cantidad</FieldLabel>
                  <Input
                    aria-invalid={Boolean(state.errors?.cantidadPlanificada)}
                    id="cantidadPlanificada"
                    min="0"
                    name="cantidadPlanificada"
                    placeholder="0"
                    step="1"
                    type="number"
                  />
                  <FieldError
                    errors={getError(state.errors, "cantidadPlanificada")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cantidadDisponible">
                    Disponible
                  </FieldLabel>
                  <Input
                    id="cantidadDisponible"
                    min="0"
                    name="cantidadDisponible"
                    placeholder="Igual a cantidad"
                    step="1"
                    type="number"
                  />
                </Field>
                <Field data-invalid={Boolean(state.errors?.unidad)}>
                  <FieldLabel htmlFor="unidad">Unidad</FieldLabel>
                  <Input
                    aria-invalid={Boolean(state.errors?.unidad)}
                    id="unidad"
                    name="unidad"
                    placeholder="cajas, unidades, frascos"
                  />
                  <FieldError errors={getError(state.errors, "unidad")} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="lote">Lote</FieldLabel>
                  <Input id="lote" name="lote" placeholder="Opcional" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fechaVencimiento">
                    Fecha de vencimiento
                  </FieldLabel>
                  <Input
                    id="fechaVencimiento"
                    name="fechaVencimiento"
                    type="date"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="observaciones">Observaciones</FieldLabel>
                <Textarea
                  id="observaciones"
                  name="observaciones"
                  placeholder="Notas para compra, traslado o uso durante el viaje"
                />
              </Field>
            </FieldGroup>

            <Button disabled={isPending} type="submit">
              <PlusIcon data-icon="inline-start" />
              {isPending ? "Guardando..." : "Agregar al viaje"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="min-h-0" size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PillIcon />
            Inventario del viaje
          </CardTitle>
          <CardDescription>
            Estos son los medicamentos e insumos disponibles para usar durante
            el viaje.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0">
          <div className="max-h-[calc(100vh-17rem)] overflow-auto rounded-3xl ring-1 ring-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="h-36 text-center text-muted-foreground"
                      colSpan={4}
                    >
                      Aun no hay inventario planificado para este viaje.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[260px] whitespace-normal">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{item.nombre}</span>
                          {item.registroSanitario ? (
                            <span className="text-xs text-muted-foreground">
                              Reg. {item.registroSanitario}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-3xl bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                          {item.categoria === "medicamento" ? (
                            <CheckCircle2Icon />
                          ) : null}
                          {item.categoria}
                        </span>
                      </TableCell>
                      <TableCell>{formatCantidad(item)}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted-foreground">
                        {[
                          item.principioActivo,
                          item.formaFarmaceutica,
                          item.viaAdministracion,
                          item.laboratorio,
                        ]
                          .filter(Boolean)
                          .join(" · ") || item.observaciones || "Sin detalle"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
