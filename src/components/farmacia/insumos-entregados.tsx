"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  CheckCircle2Icon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ViajeInventarioItem } from "@/lib/schema";

export type InsumoEntrega = {
  id: string;
  cantidad: number;
  createdAt: string;
  insumoId: string;
  insumoNombre: string;
  pacienteNombre?: string;
  observaciones?: string;
};

type InsumosEntregadosProps = {
  entregas: InsumoEntrega[];
  insumos: ViajeInventarioItem[];
  registrarAction: (formData: FormData) => Promise<{ ok: boolean; message?: string }>;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function InsumosEntregados({
  entregas,
  insumos,
  registrarAction,
}: InsumosEntregadosProps) {
  const [search, setSearch] = useState("");
  const [selectedInsumo, setSelectedInsumo] = useState<ViajeInventarioItem | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [cantidadTouched, setCantidadTouched] = useState(false);
  const [cantidadSubmitted, setCantidadSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticEntregas, addOptimistic] = useOptimistic(
    entregas,
    (state, newEntrega: InsumoEntrega) => [newEntrega, ...state],
  );

  const normalizedSearch = normalizeSearch(search);
  const filteredInsumos = normalizedSearch
    ? insumos.filter((item) =>
        normalizeSearch(item.nombre).includes(normalizedSearch),
      )
    : insumos;
  const disponible = selectedInsumo?.cantidadDisponible ?? selectedInsumo?.cantidadPlanificada ?? 0;
  const cantidadNumero = Number(cantidad);
  const cantidadError = !cantidad.trim() || !Number.isInteger(cantidadNumero) || cantidadNumero < 1
    ? "Ingresa una cantidad entera mayor que cero"
    : cantidadNumero > disponible ? `Solo hay ${disponible} disponibles` : "";
  const showCantidadError = cantidadError && (cantidadTouched || cantidadSubmitted);

  function handleSubmit(formData: FormData) {
    if (!selectedInsumo) return;

    startTransition(async () => {
      const cantidad = Number(formData.get("cantidad") || 1);
      addOptimistic({
        id: `temp-${Date.now()}`,
        cantidad,
        createdAt: new Date().toISOString(),
        insumoId: selectedInsumo.id,
        insumoNombre: selectedInsumo.nombre,
        pacienteNombre: String(formData.get("pacienteNombre") || ""),
        observaciones: String(formData.get("observaciones") || ""),
      });

      const result = await registrarAction(formData);
      if (result.ok) {
        toast.success(result.message ?? "Entrega registrada.");
        setSelectedInsumo(null);
        setCantidad("1");
        setCantidadTouched(false);
        setCantidadSubmitted(false);
      } else {
        toast.error(result.message ?? "Error al registrar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Registro rapido */}
      <div className="rounded-xl border p-4">
        <h3 className="mb-3 text-sm font-medium">Registrar entrega de insumo</h3>

        {!selectedInsumo ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar insumo..."
                type="search"
                value={search}
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              {filteredInsumos.length > 0 ? (
                filteredInsumos.map((item) => (
                  <button
                    className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                    key={item.id}
                    onClick={() => { setSelectedInsumo(item); setCantidad("1"); setCantidadTouched(false); setCantidadSubmitted(false); }}
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <PackageIcon className="size-3.5 text-muted-foreground" />
                      {item.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.cantidadDisponible ?? item.cantidadPlanificada}{" "}
                      {item.unidad}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-3 text-center text-sm text-muted-foreground">
                  {insumos.length === 0
                    ? "No hay insumos en el inventario."
                    : "Sin resultados."}
                </p>
              )}
            </div>
          </div>
        ) : (
          <form
            action={handleSubmit}
            className="flex flex-col gap-3"
            noValidate
            onSubmit={(event) => {
              setCantidadSubmitted(true);
              if (cantidadError) {
                event.preventDefault();
                event.currentTarget.querySelector<HTMLInputElement>('[name="cantidad"]')?.focus();
              }
            }}
          >
            <input name="insumoId" type="hidden" value={selectedInsumo.id} />
            <input
              name="insumoNombre"
              type="hidden"
              value={selectedInsumo.nombre}
            />

            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <PackageIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {selectedInsumo.nombre}
              </span>
              <Button
                className="ml-auto"
                onClick={() => setSelectedInsumo(null)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cambiar
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_1fr]">
              <Input
                name="pacienteNombre"
                placeholder="Paciente (opcional)"
              />
              <Input
                aria-invalid={Boolean(showCantidadError)}
                aria-describedby={showCantidadError ? "entrega-cantidad-error" : undefined}
                min={1}
                name="cantidad"
                onBlur={() => setCantidadTouched(true)}
                onChange={(event) => setCantidad(event.target.value)}
                step={1}
                type="number"
                value={cantidad}
              />
              <Input
                name="observaciones"
                placeholder="Observaciones (opcional)"
              />
            </div>
            {showCantidadError ? <p className="text-xs text-destructive" id="entrega-cantidad-error" role="alert">{cantidadError}</p> : null}

            <div className="flex justify-end">
              <Button disabled={isPending} size="sm" type="submit">
                <PlusIcon className="size-3.5" />
                {isPending ? "Registrando..." : "Registrar entrega"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Historial de entregas */}
      {optimisticEntregas.length > 0 && (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Observaciones</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optimisticEntregas.map((entrega) => (
                <TableRow key={entrega.id}>
                  <TableCell className="font-medium text-sm">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                      {entrega.insumoNombre}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {entrega.cantidad}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entrega.pacienteNombre || "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {entrega.observaciones || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(entrega.createdAt).toLocaleTimeString("es-BO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
