import { CheckCircle2Icon, PillIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ViajeInventarioItem } from "@/lib/schema";

type ViajeInventarioTableProps = {
  emptyMessage?: string;
  items: ViajeInventarioItem[];
};

function formatCantidad(item: ViajeInventarioItem) {
  const disponible =
    typeof item.cantidadDisponible === "number"
      ? item.cantidadDisponible
      : item.cantidadPlanificada;

  return `${disponible}/${item.cantidadPlanificada} ${item.unidad}`;
}

function itemDetail(item: ViajeInventarioItem) {
  return (
    [
      item.principioActivo,
      item.formaFarmaceutica,
      item.viaAdministracion,
      item.laboratorio,
    ]
      .filter(Boolean)
      .join(" · ") ||
    item.observaciones ||
    "Sin detalle"
  );
}

function stockState(item: ViajeInventarioItem) {
  const available = item.cantidadDisponible ?? item.cantidadPlanificada;
  if (item.fechaVencimiento && item.fechaVencimiento < new Date().toISOString().slice(0, 10)) return "vencido";
  if ((item.condicion ?? "disponible") !== "disponible") return item.condicion;
  if (available === 0) return "agotado";
  if (available <= (item.cantidadMinima ?? 0)) return "stock bajo";
  return "disponible";
}

export function ViajeInventarioTable({
  emptyMessage = "Aun no hay inventario planificado para este viaje.",
  items,
}: ViajeInventarioTableProps) {
  return (
    <div className="overflow-auto rounded-3xl ring-1 ring-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Lote / vencimiento</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                className="h-36 text-center text-muted-foreground"
                colSpan={6}
              >
                {emptyMessage}
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
                    ) : item.categoria === "medicamento" && item.fuente === "manual" ? (
                      <span className="text-xs font-medium text-muted-foreground">No verificado por AGEMED</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                    {item.categoria === "medicamento" ? (
                      <CheckCircle2Icon className="size-3" />
                    ) : (
                      <PillIcon className="size-3" />
                    )}
                    {item.categoria}
                  </span>
                </TableCell>
                <TableCell>{formatCantidad(item)}</TableCell>
                <TableCell><span className="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs font-medium">{stockState(item)}</span></TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.lote || "Sin lote"}{item.fechaVencimiento ? ` · ${item.fechaVencimiento}` : ""}</TableCell>
                <TableCell className="max-w-[280px] whitespace-normal text-muted-foreground">
                  {itemDetail(item)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
