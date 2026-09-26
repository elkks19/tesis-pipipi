"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilIcon, SaveIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { EditarPlaneacionSchema } from "@/lib/schema/farmacia";
import type { ViajeInventarioItem } from "@/lib/schema";

type Props = { items: ViajeInventarioItem[]; editAction: (id: string, data: FormData) => Promise<{ ok: boolean; message?: string }> };
export function InventarioPlaneacionList({ items, editAction }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    return items.filter((item) => normalize([item.nombre, item.principioActivo, item.lote, item.categoria].join(" ")).includes(normalize(query)));
  }, [items, query]);
  return <section className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-3">
      <InputGroup className="max-w-md"><InputGroupAddon><SearchIcon /></InputGroupAddon><InputGroupInput aria-label="Buscar productos del viaje" placeholder="Buscar producto, categoría o lote" value={query} onChange={(e) => setQuery(e.target.value)} /></InputGroup>
      <Badge variant="secondary">{filtered.length} productos</Badge>
    </div>
    <div className="overflow-hidden rounded-xl border">
      {filtered.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{query ? "No hay coincidencias." : "Aún no hay productos. Registra el primero en Entradas."}</p>}
      {filtered.map((item) => <article key={item.id} className="border-b last:border-0">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1"><p className="break-words font-medium">{item.nombre}</p><p className="text-xs text-muted-foreground">{[item.categoria, item.lote && `Lote ${item.lote}`, item.fechaVencimiento && `Vence ${item.fechaVencimiento}`].filter(Boolean).join(" · ")}</p></div>
          <div className="text-right text-sm"><p className="font-medium tabular-nums">{item.cantidadDisponible ?? item.cantidadPlanificada} {item.unidad}</p><p className="text-xs text-muted-foreground">{item.cantidadPlanificada} planificadas</p></div>
          <Button type="button" variant="outline" size="sm" aria-expanded={expanded === item.id} onClick={() => setExpanded(expanded === item.id ? null : item.id)}><PencilIcon data-icon="inline-start" />{expanded === item.id ? "Cerrar" : "Editar"}</Button>
        </div>
        {expanded === item.id && <EditForm key={`${item.id}:${item.updatedAt}`} item={item} action={editAction} onSaved={() => setExpanded(null)} />}
      </article>)}
    </div>
  </section>;
}

function EditForm({ item, action, onSaved }: { item: ViajeInventarioItem; action: Props["editAction"]; onSaved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ cantidadPlanificada: String(item.cantidadPlanificada), cantidadDisponible: String(item.cantidadDisponible ?? item.cantidadPlanificada), cantidadMinima: String(item.cantidadMinima ?? 0), unidad: item.unidad, lote: item.lote ?? "", fechaVencimiento: item.fechaVencimiento ?? "", observaciones: item.observaciones ?? "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const parsed = EditarPlaneacionSchema.safeParse(values);
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  const controls = [ ["cantidadPlanificada", "Cantidad planificada", "number"], ["cantidadDisponible", "Existencia preparada", "number"], ["cantidadMinima", "Stock mínimo", "number"], ["unidad", "Unidad de medida", "text"], ["lote", "Lote", "text"], ["fechaVencimiento", "Vencimiento", "date"], ["observaciones", "Observaciones", "text"] ] as const;
  return <form className="border-t bg-muted/20 p-4" noValidate onSubmit={(e) => {
    e.preventDefault(); setSubmitted(true);
    if (!parsed.success) { e.currentTarget.querySelector<HTMLInputElement>(`[name="${String(parsed.error.issues[0].path[0])}"]`)?.focus(); return; }
    if (!window.confirm("¿Guardar los cambios de este producto para el viaje?")) return;
    const data = new FormData(e.currentTarget);
    startTransition(async () => { try { const result = await action(item.id, data); if (result.ok) { toast.success(result.message); onSaved(); } else toast.error(result.message); } catch { toast.error("No se pudo guardar. Intenta nuevamente."); } });
  }}>
    <input type="hidden" name="updatedAt" value={item.updatedAt} />
    <fieldset disabled={pending} className="flex flex-col gap-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{controls.map(([name, label, type]) => {
        const error = (submitted || touched[name]) ? errors[name] : undefined;
        const id = `${item.id}-${name}`;
        return <Field key={name} data-invalid={Boolean(error)}><FieldLabel htmlFor={id}>{label}</FieldLabel><Input id={id} name={name} type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? 1 : undefined} value={values[name]} onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))} onBlur={() => setTouched((t) => ({ ...t, [name]: true }))} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} /><FieldError id={`${id}-error`}>{error}</FieldError></Field>;
      })}</FieldGroup>
      <div className="flex justify-end"><Button type="submit"><SaveIcon data-icon="inline-start" />{pending ? "Guardando…" : "Guardar cambios"}</Button></div>
    </fieldset>
  </form>;
}
