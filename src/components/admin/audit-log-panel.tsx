"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangleIcon,
  BotIcon,
  DownloadIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchXIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminAuditCategory, AdminAuditRow } from "@/lib/admin-audit";
import { cn } from "@/lib/utils";

type Actor = { email: string; id: string; name: string };
type AuditResponse = {
  actors: Actor[];
  hasNextPage: boolean;
  nextCursor?: string;
  rows: AdminAuditRow[];
};

type Filters = {
  action: string;
  actorId: string;
  component: string;
  from: string;
  model: string;
  nodeId: string;
  severity: string;
  status: string;
  to: string;
};

const categories: Array<{
  icon: typeof KeyRoundIcon;
  label: string;
  value: AdminAuditCategory;
}> = [
  { icon: KeyRoundIcon, label: "Accesos", value: "access" },
  { icon: BotIcon, label: "Agente", value: "agent" },
  { icon: RefreshCwIcon, label: "Sincronización", value: "sync" },
  { icon: AlertTriangleIcon, label: "Errores", value: "error" },
];

const emptyFilters: Filters = {
  action: "all",
  actorId: "all",
  component: "",
  from: "",
  model: "",
  nodeId: "",
  severity: "all",
  status: "all",
  to: "",
};

const actionOptions: Record<AdminAuditCategory, Array<[string, string]>> = {
  access: [
    ["login_succeeded", "Login correcto"],
    ["login_failed", "Login rechazado"],
    ["registration_succeeded", "Registro correcto"],
    ["registration_failed", "Registro rechazado"],
    ["logout_succeeded", "Cierre de sesión"],
  ],
  agent: [
    ["query", "Consulta"],
    ["preset_report", "Reporte"],
    ["artifact_changed", "Visualización"],
    ["pdf_generated", "PDF"],
  ],
  sync: [
    ["command_sync_queued", "Sincronizar solicitado"],
    ["command_pause_queued", "Pausa solicitada"],
    ["command_resume_queued", "Reanudación solicitada"],
    ["sync_cycle_failed", "Ciclo fallido"],
    ["files_synchronized", "Archivos transferidos"],
    ["document_conflict_resolved", "Conflicto documental"],
    ["file_conflict_resolved", "Conflicto de archivo"],
  ],
  error: [],
};

export function AuditLogPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCategory = searchParams.get("tab");
  const category: AdminAuditCategory = isCategory(requestedCategory) ? requestedCategory : "access";
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pending, setPending] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const params = useMemo(() => buildParams(category, filters), [category, filters]);
  const load = useCallback(async (mode: "append" | "replace", cursor?: string) => {
    setPending(true);
    try {
      const requestParams = new URLSearchParams(params);
      requestParams.set("limit", "30");
      if (cursor) requestParams.set("cursor", cursor);
      const response = await fetch(`/api/admin/audit?${requestParams}`, { cache: "no-store" });
      const data = await response.json() as AuditResponse | { message?: string };
      if (!response.ok) throw new Error("message" in data ? data.message : "No se pudieron cargar los logs.");
      const page = data as AuditResponse;
      setRows((current) => mode === "append" ? mergeRows(current, page.rows) : page.rows);
      setActors(page.actors);
      setHasNextPage(page.hasNextPage);
      setNextCursor(page.nextCursor);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los logs.");
    } finally {
      setPending(false);
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load("replace"), 120);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || !nextCursor) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !pending) void load("append", nextCursor);
    }, { rootMargin: "280px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, load, nextCursor, pending]);

  function changeCategory(value: string) {
    if (!isCategory(value)) return;
    setFilters(emptyFilters);
    router.replace(`/admin/auditoria?tab=${value}`, { scroll: false });
  }

  const current = categories.find((item) => item.value === category) ?? categories[0];
  const CurrentIcon = current.icon;
  const exportUrl = `/api/admin/audit/pdf?${params}`;

  return (
    <main className="mx-auto flex h-[calc(100svh-6.5rem)] min-h-[560px] w-full max-w-7xl flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
            <CurrentIcon className="size-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Auditoría</h1>
            <p className="text-xs text-muted-foreground">Retención: 5 años · eventos más recientes primero</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={exportUrl}>
            <DownloadIcon data-icon="inline-start" />
            Descargar PDF
          </a>
        </Button>
      </div>

      <Tabs className="min-h-0 flex-1 gap-0" onValueChange={changeCategory} value={category}>
        <div className="flex flex-col gap-3 border-b py-3">
          <TabsList className="max-w-full justify-start overflow-x-auto" variant="line">
            {categories.map(({ icon: Icon, label, value }) => (
              <TabsTrigger key={value} value={value}><Icon />{label}</TabsTrigger>
            ))}
          </TabsList>
          <AuditFilters actors={actors} category={category} filters={filters} onChange={setFilters} />
        </div>

        <TabsContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain" forceMount value={category}>
          <div className="divide-y">
            {rows.map((row) => <AuditRow key={row.id} row={row} />)}
          </div>
          {pending && rows.length === 0 ? <LoadingRows /> : null}
          {!pending && rows.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
              <SearchXIcon className="size-8 text-muted-foreground" />
              <div><p className="font-medium">No hay logs para estos filtros</p><p className="text-sm text-muted-foreground">Cambia el rango o espera nuevos eventos.</p></div>
            </div>
          ) : null}
          <div ref={sentinelRef} className="flex h-14 items-center justify-center">
            {pending && rows.length ? <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" /> : null}
            {!pending && rows.length && !hasNextPage ? <span className="text-xs text-muted-foreground">Fin del registro</span> : null}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function AuditFilters({ actors, category, filters, onChange }: {
  actors: Actor[];
  category: AdminAuditCategory;
  filters: Filters;
  onChange: (value: Filters) => void;
}) {
  const update = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      {category !== "error" ? (
        <Select onValueChange={(value) => update("actorId", value)} value={filters.actorId}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Usuario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {actors.map((actor) => <SelectItem key={actor.id} value={actor.id}>{actor.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : null}
      {actionOptions[category].length ? (
        <Select onValueChange={(value) => update("action", value)} value={filters.action}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Evento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los eventos</SelectItem>
            {actionOptions[category].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : null}
      {category !== "error" ? (
        <Select onValueChange={(value) => update("status", value)} value={filters.status}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="succeeded">Correcto</SelectItem>
            <SelectItem value="failed">Fallido</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="warning">Advertencia</SelectItem>
            {category === "agent" ? <SelectItem value="cancelled">Cancelado</SelectItem> : null}
          </SelectContent>
        </Select>
      ) : (
        <Select onValueChange={(value) => update("severity", value)} value={filters.severity}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Severidad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidad</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Advertencia</SelectItem>
            <SelectItem value="info">Información</SelectItem>
          </SelectContent>
        </Select>
      )}
      {category === "agent" ? <Input aria-label="Modelo" onChange={(event) => update("model", event.target.value)} placeholder="Modelo exacto" value={filters.model} /> : null}
      {category === "sync" ? <Input aria-label="Nodo" onChange={(event) => update("nodeId", event.target.value)} placeholder="Nodo" value={filters.nodeId} /> : null}
      {category === "error" ? <Input aria-label="Componente" onChange={(event) => update("component", event.target.value)} placeholder="Componente" value={filters.component} /> : null}
      <Input aria-label="Desde" onChange={(event) => update("from", event.target.value)} type="date" value={filters.from} />
      <Input aria-label="Hasta" onChange={(event) => update("to", event.target.value)} type="date" value={filters.to} />
      <Button className="lg:col-start-6" onClick={() => onChange(emptyFilters)} size="sm" variant="ghost">Limpiar filtros</Button>
    </div>
  );
}

function AuditRow({ row }: { row: AdminAuditRow }) {
  const detailEntries = Object.entries(row.details).filter(([, value]) => value !== null && value !== "");
  return (
    <article className="group grid gap-2 px-1 py-4 transition-colors hover:bg-muted/35 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:px-3">
      <time className="font-mono text-xs tabular-nums text-muted-foreground" dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide">{humanize(row.action)}</span>
          <StatusBadge row={row} />
        </div>
        <p className="mt-1 break-words text-sm leading-5">{row.message}</p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{row.actorName ?? row.actorEmail ?? row.actorId ?? "Sistema"}</span>
          <span>{humanize(row.component)}</span>
          <span>{row.environment} · {row.nodeId}</span>
        </p>
        {detailEntries.length ? (
          <details className="mt-2 text-xs">
            <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">Detalle técnico</summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg bg-muted/60 p-3 font-mono sm:grid-cols-2">
              {detailEntries.map(([key, value]) => <div className="min-w-0" key={key}><dt className="text-muted-foreground">{key}</dt><dd className="break-all">{String(value)}</dd></div>)}
            </dl>
          </details>
        ) : null}
      </div>
      <span className="hidden font-mono text-[10px] text-muted-foreground/70 xl:block">{row.id.slice(-12)}</span>
    </article>
  );
}

function StatusBadge({ row }: { row: AdminAuditRow }) {
  const destructive = row.status === "failed" || row.severity === "error";
  return <Badge className={cn("font-mono text-[10px] uppercase", !destructive && row.status === "succeeded" && "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")} variant={destructive ? "destructive" : "outline"}>{humanize(row.status)}</Badge>;
}

function LoadingRows() {
  return <div className="space-y-0 divide-y">{Array.from({ length: 7 }, (_, index) => <div className="grid gap-3 px-3 py-5 sm:grid-cols-[10rem_1fr]" key={index}><Skeleton className="h-3 w-28" /><div className="space-y-2"><Skeleton className="h-3 w-44" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-60" /></div></div>)}</div>;
}

function buildParams(category: AdminAuditCategory, filters: Filters) {
  const params = new URLSearchParams({ category });
  if (filters.actorId !== "all") params.set("actorId", filters.actorId);
  if (filters.action !== "all") params.set("action", filters.action);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.severity !== "all") params.set("severity", filters.severity);
  if (filters.component.trim()) params.set("component", filters.component.trim());
  if (filters.model.trim()) params.set("model", filters.model.trim());
  if (filters.nodeId.trim()) params.set("nodeId", filters.nodeId.trim());
  if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00-04:00`).toISOString());
  if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59-04:00`).toISOString());
  return params.toString();
}

function mergeRows(current: AdminAuditRow[], incoming: AdminAuditRow[]) {
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()];
}

function isCategory(value: string | null): value is AdminAuditCategory {
  return categories.some((item) => item.value === value);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "medium" });
}
