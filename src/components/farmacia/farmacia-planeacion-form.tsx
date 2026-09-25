"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Loader2Icon, PackagePlusIcon, PlusIcon } from "lucide-react";
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
  FieldDescription,
  FieldLegend,
  FieldSet,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { SimpleCombobox } from "@/components/ui/simple-combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AddInventarioItemActionState } from "@/lib/farmacia-actions";
import type { MedicamentoCatalogo, ViajeInventarioItem } from "@/lib/schema";
import { CreateViajeInventarioItemSchema } from "@/lib/schema/farmacia";

type FarmaciaPlaneacionFormProps = {
  action: (
    state: AddInventarioItemActionState,
    formData: FormData,
  ) => Promise<AddInventarioItemActionState>;
  catalogo: MedicamentoCatalogo[];
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

const emptyFields = { categoria: "medicamento", catalogoId: "", fuente: "agemed", nombre: "", principioActivo: "", cantidadPlanificada: "", cantidadDisponible: "", cantidadMinima: "0", unidad: "", concentracion: "", formaFarmaceutica: "", manualMotivo: "", viaAdministracion: "", laboratorio: "", lote: "", fechaVencimiento: "", observaciones: "" };

function getError(
  errors: AddInventarioItemActionState["errors"],
  field: string,
) {
  const message = errors?.[field];

  return message ? [{ message }] : undefined;
}

export function FarmaciaPlaneacionForm({
  action,
  catalogo,
  items,
}: FarmaciaPlaneacionFormProps) {
  const [categoria, setCategoria] = useState("medicamento");
  const [fuente, setFuente] = useState<"agemed" | "manual">("agemed");
  const [catalogoId, setCatalogoId] = useState("");
  const [fields, setFields] = useState(emptyFields);
  const formRef = useRef<HTMLFormElement>(null);
  const resetErrorsRef = useRef<() => void>(() => {});
  const [state, formAction, isPending] = useActionState(async (previousState: AddInventarioItemActionState, data: FormData) => {
    const result = await action(previousState, data);
    if (result.ok) {
      formRef.current?.reset();
      setCategoria("medicamento");
      setFuente("agemed");
      setCatalogoId("");
      setFields(emptyFields);
      resetErrorsRef.current();
    }
    return result;
  }, initialState);
  const isMedication = categoria === "medicamento";
  const selectedCatalog = catalogo.find((item) => item.id === catalogoId);

  function selectCatalog(value: string) {
    setCatalogoId(value);
    const selected = catalogo.find((item) => item.id === value);
    if (!selected) return;
    setFields((current) => ({
      ...current,
      catalogoId: value,
      concentracion: selected.concentracion ?? "",
      formaFarmaceutica: selected.formaFarmaceutica ?? "",
      nombre: selected.nombreComercial ?? selected.principioActivo,
      principioActivo: selected.principioActivo,
      viaAdministracion: selected.viaAdministracion ?? "",
      laboratorio: selected.laboratorio ?? "",
    }));
  }
  const displayState = useMemo(() => ({ ...state, ok: false }), [state]);
  const validation = CreateViajeInventarioItemSchema.safeParse({
    ...fields,
    fuente: isMedication ? fuente : "manual",
    cantidadDisponible: fields.cantidadDisponible || undefined,
    cantidadMinima: fields.cantidadMinima || "0",
  });
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

  function changeProduct(nextCategory: string, nextSource: "agemed" | "manual") {
    setCategoria(nextCategory);
    setFuente(nextSource);
    setCatalogoId("");
    setFields((current) => ({
      ...current,
      categoria: nextCategory,
      fuente: nextSource,
      catalogoId: "",
      nombre: "",
      principioActivo: "",
      concentracion: "",
      formaFarmaceutica: "",
      manualMotivo: "",
      viaAdministracion: "",
      laboratorio: "",
    }));
    resetErrors();
  }

  function inputField(
    name: keyof typeof emptyFields,
    label: string,
    placeholder = "",
    type = "text",
    description?: string,
  ) {
    return (
      <Field data-invalid={Boolean(visibleErrors[name])}>
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <Input
          id={name}
          name={name}
          type={type}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "1" : undefined}
          placeholder={placeholder}
          value={fields[name]}
          onChange={(event) => setFields((current) => ({ ...current, [name]: event.target.value }))}
          aria-invalid={Boolean(visibleErrors[name])}
          aria-describedby={[description ? `${name}-hint` : "", visibleErrors[name] ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined}
        />
        {description && <FieldDescription id={`${name}-hint`}>{description}</FieldDescription>}
        <FieldError id={`${name}-error`} errors={getError(visibleErrors, name)} />
      </Field>
    );
  }

  const officialMedication = isMedication && fuente === "agemed";
  const catalogError = visibleErrors.catalogoId ?? (officialMedication && !selectedCatalog
    ? visibleErrors.nombre ?? visibleErrors.principioActivo
    : undefined);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
              <PackagePlusIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>Agregar un producto</CardTitle>
              <CardDescription>Selecciona qué llevarás y registra las cantidades para el viaje.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} noValidate onBlurCapture={onBlurCapture} onSubmit={revealErrors}>
            <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-6">
              <FieldSet>
                <FieldLegend>1. Producto</FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="categoria">Tipo de producto</FieldLabel>
                    <Select name="categoria" value={categoria} onValueChange={(value) => changeProduct(value, value === "medicamento" ? "agemed" : "manual")}>
                      <SelectTrigger id="categoria" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup>
                        {categorias.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  {isMedication ? (
                    <Field>
                      <FieldLabel htmlFor="fuente">Origen del medicamento</FieldLabel>
                      <Select name="fuente" value={fuente} onValueChange={(value) => changeProduct(categoria, value as "agemed" | "manual")}>
                        <SelectTrigger id="fuente" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectGroup>
                          <SelectItem value="agemed">Catálogo AGEMED</SelectItem>
                          <SelectItem value="manual">Registro manual</SelectItem>
                        </SelectGroup></SelectContent>
                      </Select>
                    </Field>
                  ) : <input name="fuente" type="hidden" value="manual" />}
                </FieldGroup>
                {officialMedication ? (
                  <FieldGroup className="gap-4">
                    <Field data-invalid={Boolean(catalogError)}>
                      <FieldLabel htmlFor="catalogoId">Buscar medicamento</FieldLabel>
                      <SimpleCombobox
                        id="catalogoId"
                        aria-invalid={Boolean(catalogError)}
                        aria-describedby={catalogError ? "catalogoId-error" : "catalogoId-hint"}
                        emptyLabel="Sin resultados. Puedes usar el registro manual."
                        onValueChange={selectCatalog}
                        options={catalogo.filter((item) => item.fuente === "agemed").map((item) => ({ description: [item.nombreComercial, item.concentracion, item.formaFarmaceutica, item.registroSanitario].filter(Boolean).join(" · "), label: item.principioActivo, value: item.id }))}
                        placeholder="Selecciona un medicamento del catálogo"
                        searchPlaceholder="Buscar principio activo, marca o concentración"
                        value={catalogoId}
                      />
                      <FieldDescription id="catalogoId-hint">Busca por principio activo, marca o concentración.</FieldDescription>
                      <FieldError id="catalogoId-error">{catalogError}</FieldError>
                      <input name="catalogoId" type="hidden" value={catalogoId} />
                    </Field>
                    {selectedCatalog && (
                      <div className="rounded-xl border bg-muted/30 p-4" aria-live="polite">
                        <p className="font-medium break-words">{fields.nombre}</p>
                        <p className="mt-1 text-sm text-muted-foreground break-words">{fields.principioActivo}</p>
                        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                          {[["Concentración", fields.concentracion], ["Forma farmacéutica", fields.formaFarmaceutica], ["Registro sanitario", selectedCatalog.registroSanitario]].map(([label, value]) => (
                            <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value || "No informado"}</dd></div>
                          ))}
                        </dl>
                      </div>
                    )}
                    <input name="nombre" type="hidden" value={fields.nombre} />
                    <input name="principioActivo" type="hidden" value={fields.principioActivo} />
                    {selectedCatalog && (!fields.concentracion || !fields.formaFarmaceutica) && <FieldDescription>Completa los datos que faltan en el catálogo para registrar este medicamento.</FieldDescription>}
                    {selectedCatalog && !selectedCatalog.concentracion
                      ? inputField("concentracion", "Concentración", "Ej. 500 mg")
                      : <input name="concentracion" type="hidden" value={fields.concentracion} />}
                    {selectedCatalog && !selectedCatalog.formaFarmaceutica
                      ? inputField("formaFarmaceutica", "Forma farmacéutica", "Ej. Tableta")
                      : <input name="formaFarmaceutica" type="hidden" value={fields.formaFarmaceutica} />}
                    {selectedCatalog && <>
                      <input name="atcCode" type="hidden" value={selectedCatalog.atcCode ?? ""} />
                      <input name="nombreComercial" type="hidden" value={selectedCatalog.nombreComercial ?? ""} />
                      <input name="registroSanitario" type="hidden" value={selectedCatalog.registroSanitario ?? ""} />
                      <input name="titularRegistro" type="hidden" value={selectedCatalog.titularRegistro ?? ""} />
                    </>}
                  </FieldGroup>
                ) : (
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {inputField("nombre", "Nombre del producto", isMedication ? "Ej. Paracetamol" : "Ej. Gasa estéril")}
                    {isMedication && <>
                      {inputField("principioActivo", "Principio activo", "Ej. Paracetamol")}
                      {inputField("concentracion", "Concentración", "Ej. 500 mg")}
                      {inputField("formaFarmaceutica", "Forma farmacéutica", "Ej. Tableta")}
                      <div className="sm:col-span-2">{inputField("manualMotivo", "Motivo del registro manual", "Ej. No figura en el catálogo AGEMED")}</div>
                    </>}
                  </FieldGroup>
                )}
              </FieldSet>
              <Separator />
              <FieldSet>
                <FieldLegend>2. Cantidades</FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {inputField("cantidadPlanificada", "Cantidad planificada", "Ej. 100", "number")}
                  {inputField("unidad", "Unidad de medida", "Ej. tabletas, cajas", "text", "Usa la misma unidad para todas las cantidades.")}
                  {inputField("cantidadDisponible", "Existencia inicial", fields.cantidadPlanificada || "Igual a lo planificado", "number", "Si la dejas vacía, se usa la cantidad planificada.")}
                  {inputField("cantidadMinima", "Stock mínimo", "0", "number", "Umbral para avisar de existencias bajas.")}
                </FieldGroup>
              </FieldSet>
              <Separator />
              <FieldSet>
                <FieldLegend>3. Lote y detalles</FieldLegend>
                <FieldDescription>Datos opcionales para identificar y organizar las existencias.</FieldDescription>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  {inputField("lote", "Número de lote", "Ej. L-2026-01")}
                  {inputField("fechaVencimiento", "Fecha de vencimiento", "", "date")}
                  {isMedication && <>
                    {inputField("viaAdministracion", "Vía de administración", "Ej. Oral")}
                    {inputField("laboratorio", "Laboratorio", "Nombre del laboratorio")}
                  </>}
                  <div className="sm:col-span-2">{inputField("observaciones", "Observaciones", "Notas sobre este producto o su almacenamiento")}</div>
                </FieldGroup>
              </FieldSet>
              <input name="condicion" type="hidden" value="disponible" />
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">El producto se añadirá al inventario de este viaje.</p>
                <Button disabled={isPending} type="submit" className="w-full sm:w-auto">
                  {isPending ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : <PlusIcon data-icon="inline-start" />}
                  {isPending ? "Guardando…" : "Agregar al inventario"}
                </Button>
              </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Inventario planificado</CardTitle>
          <CardDescription>{items.length} {items.length === 1 ? "producto registrado" : "productos registrados"} para el viaje.</CardDescription>
        </CardHeader>
        <CardContent><ViajeInventarioTable items={items} /></CardContent>
      </Card>
    </div>
  );
}
