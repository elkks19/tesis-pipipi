"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ChevronDownIcon, ClockIcon, Loader2Icon, PillIcon, PrinterIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecetaPageResult, RecetaRow } from "@/lib/farmacia";
import type { ViajeInventarioItem } from "@/lib/schema";
import { cn } from "@/lib/utils";

type Props = {
  canDeliver: boolean;
  canEdit: boolean;
  dispenseAction: (recetaId: string, lines: Array<{ cantidad: number; inventarioItemId: string; recetaMedicamentoIndex: number }>) => Promise<{ ok: boolean; message?: string }>;
  initialPage: RecetaPageResult;
  inventory: ViajeInventarioItem[];
  loadPageAction: (input: { cursor?: string; query?: string }) => Promise<RecetaPageResult>;
};

export function RecetasPendientesList({ canDeliver, canEdit, dispenseAction, initialPage, inventory, loadPageAction }: Props) {
  const [recetas, setRecetas] = useState(initialPage.rows);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [hasNextPage, setHasNextPage] = useState(initialPage.hasNextPage);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const lastRequestedQueryRef = useRef("");

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery === lastRequestedQueryRef.current) return;
    lastRequestedQueryRef.current = normalizedQuery;
    const requestId = ++requestIdRef.current;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const page = await loadPageAction({ query: normalizedQuery });
        if (requestId !== requestIdRef.current) return;
        setRecetas(page.rows);
        setCursor(page.nextCursor);
        setHasNextPage(page.hasNextPage);
        setExpandedId(null);
      } catch (error) {
        if (requestId === requestIdRef.current) toast.error(error instanceof Error ? error.message : "No se pudieron buscar las recetas.");
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [loadPageAction, query]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isLoading) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      void loadPageAction({ cursor, query: query.trim() })
        .then((page) => {
          if (requestId !== requestIdRef.current) return;
          setRecetas((current) => {
            const known = new Set(current.map((receta) => receta.id));
            return [...current, ...page.rows.filter((receta) => !known.has(receta.id))];
          });
          setCursor(page.nextCursor);
          setHasNextPage(page.hasNextPage && page.nextCursor !== cursor);
        })
        .catch((error) => {
          if (requestId === requestIdRef.current) toast.error(error instanceof Error ? error.message : "No se pudieron cargar mas recetas.");
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setIsLoading(false);
        });
    }, { rootMargin: "240px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, hasNextPage, isLoading, loadPageAction, query]);

  const faltantes = recetas.filter((receta) => receta.estado !== "entregada").flatMap((receta) =>
    receta.medicamentos
      .map((medicine, index) => ({ medicine, pending: Math.max(0, (medicine.cantidad ?? 0) - (receta.cantidadesEntregadas[index] ?? 0)) }))
      .filter(({ medicine, pending }) => pending > 0 && getInventoryOptions(medicine, inventory).length === 0)
      .map(({ medicine, pending }) => ({ cantidad: pending, concentracion: medicine.concentracion, nombre: medicine.nombre, paciente: receta.pacienteNombre, unidad: medicine.unidad })),
  );

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar recetas por paciente" className="pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, apellido o CI" value={query} />
          {isLoading && <Loader2Icon className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{recetas.length} receta(s) cargada(s)</span>
      </div>

      {faltantes.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30">
          <span className="min-w-0 text-sm text-amber-800 dark:text-amber-200">{faltantes.length} medicamento(s) sin stock entre las recetas cargadas</span>
          <Button className="shrink-0" onClick={() => printFaltantes(faltantes)} size="sm" variant="outline"><PrinterIcon className="size-3.5" /> Imprimir faltantes</Button>
        </div>
      )}

      <div className="min-w-0 overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(7rem,.65fr)_8rem_7rem_2rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Paciente</span><span>Medicamentos</span><span>Fecha</span><span>Estado</span><span />
        </div>
        {recetas.length === 0 && !isLoading ? (
          <div className="px-4 py-14 text-center text-sm text-muted-foreground">{query.trim() ? "No se encontraron recetas para ese paciente." : "No hay recetas registradas para este viaje."}</div>
        ) : recetas.map((receta) => {
          const isExpanded = expandedId === receta.id;
          return (
            <article className="min-w-0 border-b last:border-b-0" key={receta.id}>
              <button aria-expanded={isExpanded} className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 md:grid-cols-[minmax(0,1.5fr)_minmax(7rem,.65fr)_8rem_7rem_2rem]" onClick={() => setExpandedId(isExpanded ? null : receta.id)} type="button">
                <span className="min-w-0 truncate font-medium">{receta.pacienteNombre}</span>
                <span className="hidden text-sm text-muted-foreground md:block">{receta.medicamentos.length} medicamento(s)</span>
                <span className="hidden text-sm md:block">{formatDate(receta.createdAt)}</span>
                <Status estado={receta.estado} />
                <ChevronDownIcon className={cn("size-4 justify-self-end text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                <span className="col-span-2 truncate text-xs text-muted-foreground md:hidden">{receta.medicamentos.length} medicamento(s) · {formatDate(receta.createdAt)}</span>
              </button>
              {isExpanded && <div className="min-w-0 border-t bg-muted/20 p-3 sm:p-4"><RecetaDetail canDeliver={canDeliver} canEdit={canEdit} dispenseAction={dispenseAction} inventory={inventory} receta={receta} /></div>}
            </article>
          );
        })}
      </div>
      <div className="flex h-9 items-center justify-center" ref={sentinelRef}>
        {isLoading ? <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> Cargando recetas</span> : hasNextPage ? <span className="text-xs text-muted-foreground">Desplazate para cargar mas</span> : recetas.length > 0 ? <span className="text-xs text-muted-foreground">Fin de los resultados</span> : null}
      </div>
    </div>
  );
}

function Status({ estado }: { estado: RecetaRow["estado"] }) {
  const delivered = estado === "entregada";
  return <span className={cn("inline-flex shrink-0 items-center gap-1 justify-self-end text-xs font-medium md:justify-self-start", delivered ? "text-emerald-600 dark:text-emerald-400" : estado === "parcial" ? "text-primary" : "text-amber-600 dark:text-amber-400")}>{delivered ? <CheckCircle2Icon className="size-3.5" /> : <ClockIcon className="size-3.5" />}{delivered ? "Entregada" : estado === "parcial" ? "Parcial" : "Pendiente"}</span>;
}

function RecetaDetail({ canDeliver, canEdit, dispenseAction, inventory, receta }: { canDeliver: boolean; canEdit: boolean; dispenseAction: Props["dispenseAction"]; inventory: ViajeInventarioItem[]; receta: RecetaRow }) {
  void canEdit;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState(() => receta.medicamentos.map((medicine, index) => {
    const options = getInventoryOptions(medicine, inventory);
    return { cantidad: Math.max(0, (medicine.cantidad ?? 0) - (receta.cantidadesEntregadas[index] ?? 0)), inventarioItemId: options[0]?.id ?? "" };
  }));

  function deliver() {
    const lines = values.map((value, index) => ({ ...value, recetaMedicamentoIndex: index })).filter((line) => line.cantidad > 0 && line.inventarioItemId);
    startTransition(async () => {
      const result = await dispenseAction(receta.id, lines);
      if (result.ok) { toast.success(result.message); router.refresh(); }
      else toast.error(result.message ?? "No se pudo registrar la entrega.");
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {receta.indicacionesGenerales && <p className="break-words text-sm text-muted-foreground"><span className="font-medium text-foreground">Indicaciones: </span>{receta.indicacionesGenerales}</p>}
      <div className="grid min-w-0 gap-2">
        {receta.medicamentos.map((med, index) => {
          const options = getInventoryOptions(med, inventory);
          const pending = Math.max(0, (med.cantidad ?? 0) - (receta.cantidadesEntregadas[index] ?? 0));
          return (
            <div className="grid min-w-0 gap-3 rounded-lg border bg-background p-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" key={`${receta.id}:${index}`}>
              <div className="min-w-0">
                <div className="flex min-w-0 items-start gap-2"><PillIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="break-words text-sm font-medium">{med.nombre}</p><p className="break-words text-xs text-muted-foreground">{[med.concentracion, med.formaFarmaceutica].filter(Boolean).join(" · ") || "Sin presentacion registrada"}</p></div></div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
                  <MedicationDatum label="Dosis" value={med.dosis} /><MedicationDatum label="Frecuencia" value={med.frecuencia} /><MedicationDatum label="Duracion" value={med.duracion} /><MedicationDatum label="Cantidad" value={med.cantidad ? `${med.cantidad} ${med.unidad ?? "unidades"}` : "—"} /><MedicationDatum label="Via" value={med.viaAdministracion} /><MedicationDatum label="Pendiente" value={`${pending} ${med.unidad ?? "unidades"}`} />
                </dl>
                {med.indicaciones && <p className="mt-3 break-words text-xs text-muted-foreground">{med.indicaciones}</p>}
              </div>
              <div className="min-w-0 self-center">
                {pending > 0 && canDeliver ? <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
                  <select className="h-9 min-w-0 max-w-full rounded-md border bg-background px-2 text-xs" onChange={(event) => setValues((current) => current.map((value, valueIndex) => valueIndex === index ? { ...value, inventarioItemId: event.target.value } : value))} value={values[index]?.inventarioItemId ?? ""}><option value="">Sin lote disponible</option>{options.map((item) => <option key={item.id} value={item.id}>{item.lote || "Sin lote"} · {item.cantidadDisponible ?? item.cantidadPlanificada} disp. · {item.fechaVencimiento || "sin vencimiento"}</option>)}</select>
                  <Input className="h-9 min-w-0" max={pending} min={1} onChange={(event) => setValues((current) => current.map((value, valueIndex) => valueIndex === index ? { ...value, cantidad: Number(event.target.value) } : value))} type="number" value={values[index]?.cantidad ?? 0} />
                </div> : <span className="text-xs text-muted-foreground">{pending === 0 ? "Entrega completa" : "Sin lote disponible"}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {canDeliver && receta.estado !== "entregada" && <div className="flex justify-end"><Button disabled={isPending || values.every((value) => !value.inventarioItemId || value.cantidad <= 0)} onClick={deliver} size="sm"><CheckCircle2Icon />{isPending ? "Registrando..." : "Registrar entrega"}</Button></div>}
      {receta.entregadaAt && <p className="text-xs text-muted-foreground">Entregada el {formatDate(receta.entregadaAt, true)}</p>}
    </div>
  );
}

function MedicationDatum({ label, value }: { label: string; value?: string }) { return <div className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value || "—"}</dd></div>; }

const dateFormatter = new Intl.DateTimeFormat("es-BO", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", timeZone: "America/La_Paz" });
const fullDateFormatter = new Intl.DateTimeFormat("es-BO", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", timeZone: "America/La_Paz", year: "numeric" });
function formatDate(value: string, full = false) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Fecha no disponible" : (full ? fullDateFormatter : dateFormatter).format(date); }

function getInventoryOptions(medicine: RecetaRow["medicamentos"][number], inventory: ViajeInventarioItem[]) {
  const today = new Date().toISOString().slice(0, 10);
  return inventory.filter((item) => {
    const available = item.cantidadDisponible ?? item.cantidadPlanificada;
    const matches = medicine.catalogoId ? item.catalogoId === medicine.catalogoId : medicine.inventarioItemId ? item.id === medicine.inventarioItemId : item.principioActivo?.toLocaleLowerCase("es") === medicine.principioActivo?.toLocaleLowerCase("es");
    return matches && available > 0 && (item.condicion ?? "disponible") === "disponible" && (!item.fechaVencimiento || item.fechaVencimiento >= today);
  }).sort((a, b) => (a.fechaVencimiento ?? "9999-12-31").localeCompare(b.fechaVencimiento ?? "9999-12-31"));
}

type FaltanteItem = { cantidad?: number; concentracion?: string; nombre: string; paciente: string; unidad?: string };
function printFaltantes(faltantes: FaltanteItem[]) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
  const rows = faltantes.map((item) => `<tr><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.concentracion ?? "—")}</td><td>${item.cantidad ?? "—"} ${escapeHtml(item.unidad ?? "")}</td><td>${escapeHtml(item.paciente)}</td></tr>`).join("");
  printWindow.document.write(`<!DOCTYPE html><html><head><title>Medicamentos faltantes en farmacia</title><style>body{font-family:sans-serif;padding:24px}h1{font-size:18px;margin-bottom:4px}p{color:#666;font-size:13px;margin-bottom:16px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px 12px;border:1px solid #ddd;font-size:13px}th{background:#f5f5f5}</style></head><body><h1>Medicamentos faltantes en inventario</h1><p>Generado: ${new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date())}</p><table><thead><tr><th>Medicamento</th><th>Concentracion</th><th>Cantidad</th><th>Paciente</th></tr></thead><tbody>${rows}</tbody></table><p>Estos medicamentos fueron recetados pero no se encontraron en el inventario del viaje.</p></body></html>`);
  printWindow.document.close();
  printWindow.print();
}
