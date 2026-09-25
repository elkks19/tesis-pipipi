"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { StationActivityList } from "@/components/activity/station-activity-list";
import { type ActivityListRow, type ActivityMode, withActivityLinks } from "@/components/activity/station-activity-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActivityPageResult } from "@/lib/activity-queries";
import type { StationKey } from "@/lib/station-histories";

type Props = { basePath: string; hasNextPage: boolean; initialRows: ActivityListRow[]; initialPage: number; total: number; totalPages: number; mode: ActivityMode; nextCursor?: string; stationKey: StationKey };

export function StationActivityFeed({ basePath, initialRows, initialPage, total, totalPages, mode, stationKey }: Props) {
  const [view, setView] = useState({ rows: initialRows, page: initialPage, total, totalPages, query: "" });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const currentRef = useRef({ page: initialPage, query: "" });
  const loadPage = useCallback(async (page: number, query: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ mode, stationKey, page: String(page), q: query });
      const response = await fetch(`/api/activity/station?${params}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("No se pudo actualizar la actividad. Intenta de nuevo.");
      const result = await response.json() as ActivityPageResult;
      if (controller.signal.aborted) return;
      currentRef.current = { page: result.page, query };
      setView({ rows: withActivityLinks({ basePath, mode, stationKey, rows: result.rows }), page: result.page, total: result.total, totalPages: result.totalPages, query });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar la actividad.");
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [basePath, mode, stationKey]);
  useEffect(() => {
    const refresh = () => { void loadPage(currentRef.current.page, currentRef.current.query); };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { requestRef.current?.abort(); window.removeEventListener("focus", refresh); };
  }, [loadPage]);
  return (
    <div className="flex flex-col gap-4" aria-busy={isLoading}>
      <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:p-5">
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void loadPage(1, draft.trim()); }}>
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
            <Label htmlFor="activity-search">Buscar actividad</Label>
            <Input id="activity-search" maxLength={200} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nombre, documento, responsable o tipo de movimiento" />
          </div>
          <Button type="submit" disabled={isLoading}><SearchIcon data-icon="inline-start" />Buscar</Button>
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => { void loadPage(1, view.query); }}><RefreshCwIcon data-icon="inline-start" />Actualizar</Button>
          {draft || view.query ? <Button type="button" variant="ghost" disabled={isLoading} onClick={() => { setDraft(""); void loadPage(1, ""); }}>Limpiar</Button> : null}
        </form>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground" role="status">
          <span>{isLoading ? "Cargando actividad…" : `${view.total} movimientos${view.query ? ` para “${view.query}”` : " en el viaje activo"}`}</span>
          <span>Más recientes primero · Hora de Bolivia</span>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {view.rows.length ? <StationActivityList mode={mode} rows={view.rows} /> : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-12 text-center">
          <SearchIcon className="mb-2 size-6 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">{view.query ? "No encontramos coincidencias" : "Todavía no hay actividad"}</p>
          <p className="text-sm text-muted-foreground">{view.query ? "Prueba con otro nombre o documento, o limpia la búsqueda." : "Los movimientos guardados durante el viaje aparecerán aquí."}</p>
        </div>
      )}
      <nav aria-label="Paginación de actividad" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4">
        <p className="text-xs text-muted-foreground">{view.total ? `Mostrando ${(view.page - 1) * 15 + 1}–${Math.min(view.page * 15, view.total)} de ${view.total}` : "0 resultados"}</p>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" variant="outline" disabled={isLoading || view.page <= 1} onClick={() => { void loadPage(view.page - 1, view.query); }}><ChevronLeftIcon data-icon="inline-start" />Anterior</Button>
          <span className="text-xs tabular-nums">{view.page} / {view.totalPages}</span>
          <Button type="button" size="sm" variant="outline" disabled={isLoading || view.page >= view.totalPages} onClick={() => { void loadPage(view.page + 1, view.query); }}>Siguiente<ChevronRightIcon data-icon="inline-end" /></Button>
        </div>
      </nav>
    </div>
  );
}
