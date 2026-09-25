"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPinIcon, XIcon } from "lucide-react";

import { DateRangeField, Field } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ViajesFiltersProps = {
  filters: {
    fechaDesde: string;
    fechaHasta: string;
    lugar: string;
  };
};

export function ViajesFilters({ filters }: ViajesFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lugar, setLugar] = useState(filters.lugar);
  const [fechaDesde, setFechaDesde] = useState(filters.fechaDesde);
  const [fechaHasta, setFechaHasta] = useState(filters.fechaHasta);

  const hasFilters = Boolean(lugar || fechaDesde || fechaHasta);

  const nextQuery = useMemo(() => {
    const params = new URLSearchParams();

    if (lugar.trim()) {
      params.set("lugar", lugar.trim());
    }

    if (fechaDesde) {
      params.set("desde", fechaDesde);
    }

    if (fechaHasta) {
      params.set("hasta", fechaHasta);
    }

    return params.toString();
  }, [fechaDesde, fechaHasta, lugar]);

  useEffect(() => {
    const currentFilters = new URLSearchParams(searchParams.toString());
    const nextFilters = new URLSearchParams(nextQuery);
    if (["lugar", "desde", "hasta"].every((key) => currentFilters.get(key) === nextFilters.get(key)) && !currentFilters.has("fecha")) return;

    const timeout = window.setTimeout(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [nextQuery, pathname, router, searchParams]);

  function clearFilters() {
    setLugar("");
    setFechaDesde("");
    setFechaHasta("");
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
      <Field>
        <Label htmlFor="lugar">Lugar o establecimiento</Label>
        <div className="relative">
          <MapPinIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            id="lugar"
            onChange={(event) => setLugar(event.target.value)}
            placeholder="Municipio, establecimiento o servicio"
            value={lugar}
          />
        </div>
      </Field>
      <DateRangeField
        endName="hasta"
        label="Rango de fechas"
        onChange={(value) => {
          setFechaDesde(value.from);
          setFechaHasta(value.to);
        }}
        startName="desde"
        value={{
          from: fechaDesde,
          to: fechaHasta,
        }}
      />
      <div className="flex items-end">
        <Button
          className="w-full"
          disabled={!hasFilters}
          onClick={clearFilters}
          type="button"
          variant="outline"
        >
          <XIcon data-icon="inline-start" />
          Limpiar
        </Button>
      </div>
    </div>
  );
}
