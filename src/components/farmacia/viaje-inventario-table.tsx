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
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                className="h-36 text-center text-muted-foreground"
                colSpan={4}
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
