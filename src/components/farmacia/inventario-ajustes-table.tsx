"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ChevronDownIcon, PackageIcon, PillIcon, SaveIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ViajeInventarioItem } from "@/lib/schema";
import { cn } from "@/lib/utils";

type Props = {
  deleteAction: (itemId: string) => Promise<{ ok: boolean; message?: string }>;
  items: ViajeInventarioItem[];
  updateAction: (itemId: string, formData: FormData) => Promise<{ ok: boolean; message?: string }>;
};

export function InventarioAjustesTable({ deleteAction, items, updateAction }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return items;
    return items.filter((item) => normalize([item.nombre, item.principioActivo, item.concentracion, item.lote].filter(Boolean).join(" ")).includes(normalizedQuery));
  }, [items, query]);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border bg-background">
      <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar item de inventario" className="h-9 pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar medicamento, insumo o lote" value={query} />
        </div>
        <span className="text-xs text-muted-foreground">{filteredItems.length} item(s)</span>
      </div>

      {filteredItems.length === 0 ? (
        <div className="px-4 py-14 text-center text-sm text-muted-foreground">{query ? "No hay coincidencias en el inventario." : "No hay items en el inventario."}</div>
      ) : filteredItems.map((item) => {
        const expanded = expandedId === item.id;
        return (
          <article className="min-w-0 border-b last:border-b-0" key={item.id}>
            <button aria-expanded={expanded} className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 sm:grid-cols-[auto_minmax(0,1fr)_8rem_8rem_auto]" onClick={() => setExpandedId(expanded ? null : item.id)} type="button">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">{item.categoria === "medicamento" ? <PillIcon className="size-4" /> : <PackageIcon className="size-4" />}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">{[item.principioActivo, item.concentracion, item.lote && `Lote ${item.lote}`].filter(Boolean).join(" · ") || item.categoria}</span>
              </span>
              <span className="text-right sm:text-left">
                <span className="block text-sm font-semibold tabular-nums">{item.cantidadDisponible ?? item.cantidadPlanificada} {item.unidad}</span>
                <span className="block text-xs text-muted-foreground">de {item.cantidadPlanificada} planificadas</span>
              </span>
              <ConditionLabel condition={item.condicion ?? "disponible"} />
              <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded && <AdjustmentForm deleteAction={deleteAction} item={item} updateAction={updateAction} />}
          </article>
        );
      })}
    </section>
  );
}

function AdjustmentForm({ deleteAction, item, updateAction }: { deleteAction: Props["deleteAction"]; item: ViajeInventarioItem; updateAction: Props["updateAction"] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [cantidad, setCantidad] = useState(String(item.cantidadDisponible ?? item.cantidadPlanificada));
  const [condicion, setCondicion] = useState(item.condicion ?? "disponible");
  const [motivo, setMotivo] = useState("");
  const [tipo, setTipo] = useState("ajuste");
  const [touched, setTouched] = useState({ cantidad: false, motivo: false });
  const [submitted, setSubmitted] = useState(false);
  const parsedCantidad = Number(cantidad);
  const cantidadError = !cantidad.trim() || !Number.isInteger(parsedCantidad) || parsedCantidad < 0 ? "Ingresa una cantidad entera no negativa." : "";
  const motivoError = motivo.trim().length < 3 ? "Describe el motivo con al menos 3 caracteres." : "";
  const showCantidadError = Boolean(cantidadError && (touched.cantidad || submitted));
  const showMotivoError = Boolean(motivoError && (touched.motivo || submitted));

  function handleSave() {
    if (!formRef.current) return;
    setSubmitted(true);
    if (cantidadError) { quantityRef.current?.focus(); return; }
    if (motivoError) { reasonRef.current?.focus(); return; }

    startTransition(async () => {
      const result = await updateAction(item.id, new FormData(formRef.current!));
      if (result.ok) {
        toast.success(result.message);
        setMotivo("");
        setSubmitted(false);
        setTouched({ cantidad: false, motivo: false });
      } else toast.error(result.message ?? "No se pudo registrar el ajuste.");
    });
  }

  function handleDelete() {
    if (!window.confirm(`¿Eliminar ${item.nombre} del inventario?`)) return;
    startTransition(async () => {
      const result = await deleteAction(item.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message ?? "No se pudo eliminar el item.");
    });
  }

  return (
    <form className="min-w-0 border-t bg-muted/20 px-4 py-4" noValidate ref={formRef}>
      <input name="cantidadActual" type="hidden" value={item.cantidadDisponible ?? item.cantidadPlanificada} />
      <input name="condicion" type="hidden" value={condicion} />
      <input name="tipo" type="hidden" value={tipo} />

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Field controlId={`tipo-${item.id}`} label="Tipo de movimiento">
          <Select onValueChange={setTipo} value={tipo}>
            <SelectTrigger className="w-full" id={`tipo-${item.id}`}><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value="ajuste">Correccion de saldo</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="devolucion">Devolucion</SelectItem>
              <SelectItem value="merma">Merma</SelectItem>
            </SelectGroup></SelectContent>
          </Select>
        </Field>

        <Field controlId={`cantidad-${item.id}`} error={showCantidadError ? cantidadError : undefined} errorId={`cantidad-${item.id}-error`} label={`Nueva existencia (${item.unidad})`}>
          <Input aria-describedby={showCantidadError ? `cantidad-${item.id}-error` : undefined} aria-invalid={showCantidadError} id={`cantidad-${item.id}`} min={0} name="cantidadDisponible" onBlur={() => setTouched((current) => ({ ...current, cantidad: true }))} onChange={(event) => setCantidad(event.target.value)} ref={quantityRef} step={1} type="number" value={cantidad} />
        </Field>

        <Field controlId={`condicion-${item.id}`} label="Condicion del lote">
          <Select onValueChange={(value) => setCondicion(value as typeof condicion)} value={condicion}>
            <SelectTrigger className="w-full" id={`condicion-${item.id}`}><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value="disponible">Disponible</SelectItem>
              <SelectItem value="cuarentena">Cuarentena</SelectItem>
              <SelectItem value="danado">Danado</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectGroup></SelectContent>
          </Select>
        </Field>

        <Field controlId={`motivo-${item.id}`} error={showMotivoError ? motivoError : undefined} errorId={`motivo-${item.id}-error`} label="Motivo">
          <Input aria-describedby={showMotivoError ? `motivo-${item.id}-error` : undefined} aria-invalid={showMotivoError} id={`motivo-${item.id}`} name="motivo" onBlur={() => setTouched((current) => ({ ...current, motivo: true }))} onChange={(event) => setMotivo(event.target.value)} placeholder="Ej. conteo fisico de cierre" ref={reasonRef} value={motivo} />
        </Field>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
        <Button disabled={isPending} onClick={handleDelete} size="sm" type="button" variant="ghost"><Trash2Icon className="size-4 text-destructive" /><span className="text-destructive">Eliminar item</span></Button>
        <Button disabled={isPending} onClick={handleSave} size="sm" type="button"><SaveIcon className="size-4" />{isPending ? "Guardando..." : "Guardar ajuste"}</Button>
      </div>
    </form>
  );
}

function Field({ children, controlId, error, errorId, label }: { children: React.ReactNode; controlId: string; error?: string; errorId?: string; label: string }) {
  return <div className="grid min-w-0 gap-1.5 text-sm font-medium"><label htmlFor={controlId}>{label}</label>{children}{error && <span className="text-xs font-normal text-destructive" id={errorId} role="alert">{error}</span>}</div>;
}

function ConditionLabel({ condition }: { condition: NonNullable<ViajeInventarioItem["condicion"]> }) {
  const labels = { disponible: "Disponible", cuarentena: "Cuarentena", danado: "Danado", vencido: "Vencido" };
  return <span className={cn("hidden w-fit rounded-md border px-2 py-1 text-xs font-medium sm:inline-flex", condition === "disponible" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300")}>{labels[condition]}</span>;
}

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
