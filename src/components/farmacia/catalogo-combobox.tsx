"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import type { CatalogoOption, CatalogoPage } from "@/lib/farmacia-catalogo-search";

type Props = {
  mode: "docente" | "estudiante";
  value: CatalogoOption | null;
  onValueChange: (item: CatalogoOption | null) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function CatalogoCombobox({ mode, value, onValueChange, ...aria }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogoOption[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const retryOffset = useRef(0);

  const load = useCallback(async (offset: number) => {
    if (busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    request.current = controller;
    retryOffset.current = offset;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ mode, q: query, offset: String(offset) });
      const response = await fetch(`/api/farmacia/catalogo?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("No se pudo cargar el catálogo. Intenta nuevamente.");
      const page: CatalogoPage = await response.json();
      if (controller.signal.aborted) return;
      setItems((previous) => offset === 0 ? page.items : [...new Map([...previous, ...page.items].map((item) => [item.id, item])).values()]);
      setNextOffset(page.nextOffset);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Error de conexión.");
    } finally {
      if (request.current === controller) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [mode, query]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { void load(0); }, 250);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
      request.current = null;
      busy.current = false;
    };
  }, [open, load]);

  function resetSearch(next: string) {
    request.current?.abort();
    request.current = null;
    busy.current = false;
    setItems([]);
    setNextOffset(null);
    setError("");
    setLoading(true);
    setQuery(next);
  }

  return (
    <Combobox<CatalogoOption>
      items={items} filter={null} value={value} open={open}
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringLabel={(item) => [item.principioActivo, item.concentracion, item.nombreComercial].filter(Boolean).join(" · ")}
      onValueChange={onValueChange}
      onOpenChange={(next) => { if (next) resetSearch(""); setOpen(next); }}
      onInputValueChange={(text, details) => { if (details.reason === "input-change" && text !== query) resetSearch(text); }}
    >
      <ComboboxInput id="catalogoId" {...aria} className="w-full" maxLength={120} placeholder="Buscar principio activo, marca o concentración" />
      <ComboboxContent>
        <ComboboxList aria-busy={loading} onScroll={(event) => {
          const element = event.currentTarget;
          if (!error && nextOffset !== null && element.scrollHeight - element.scrollTop - element.clientHeight < 100) void load(nextOffset);
        }}>
          {(item: CatalogoOption) => (
            <ComboboxItem key={item.id} value={item}>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="break-words">{item.principioActivo}</span>
                <span className="text-xs text-muted-foreground break-words">{[item.nombreComercial, item.concentracion, item.formaFarmaceutica, item.registroSanitario].filter(Boolean).join(" · ")}</span>
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
        <div className="flex flex-col items-center gap-2 px-3 py-2" role="status" aria-live="polite">
          {loading ? <span className="text-sm text-muted-foreground">Buscando medicamentos…</span> : error ? <><span className="text-sm text-destructive">{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void load(retryOffset.current)}>Reintentar</Button></> : items.length === 0 ? <span className="text-sm text-muted-foreground">Sin resultados. Puedes usar el registro manual.</span> : nextOffset !== null ? <Button type="button" variant="ghost" size="sm" onClick={() => void load(nextOffset)}>Cargar más resultados</Button> : <span className="text-xs text-muted-foreground">Fin de los resultados</span>}
        </div>
      </ComboboxContent>
    </Combobox>
  );
}
