"use client";

import { useRef, useTransition } from "react";
import { SaveIcon, Trash2Icon } from "lucide-react";
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

type InventarioAjustesTableProps = {
  deleteAction: (itemId: string) => Promise<{ ok: boolean; message?: string }>;
  items: ViajeInventarioItem[];
  updateAction: (
    itemId: string,
    formData: FormData,
  ) => Promise<{ ok: boolean; message?: string }>;
};

export function InventarioAjustesTable({
  deleteAction,
  items,
  updateAction,
}: InventarioAjustesTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="w-28">Planificada</TableHead>
            <TableHead className="w-32">Disponible</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Observaciones</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                className="h-28 text-center text-muted-foreground"
                colSpan={7}
              >
                No hay items en el inventario.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <InventarioItemRow
                key={item.id}
                deleteAction={deleteAction}
                item={item}
                updateAction={updateAction}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function InventarioItemRow({
  deleteAction,
  item,
  updateAction,
}: {
  deleteAction: (itemId: string) => Promise<{ ok: boolean; message?: string }>;
  item: ViajeInventarioItem;
  updateAction: (
    itemId: string,
    formData: FormData,
  ) => Promise<{ ok: boolean; message?: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!formRef.current) return;

    startTransition(async () => {
      const formData = new FormData(formRef.current!);
      const result = await updateAction(item.id, formData);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Error al actualizar.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("¿Eliminar este item del inventario?")) return;

    startTransition(async () => {
      const result = await deleteAction(item.id);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message ?? "Error al eliminar.");
      }
    });
  }

  const disponible =
    typeof item.cantidadDisponible === "number"
      ? item.cantidadDisponible
      : item.cantidadPlanificada;

  return (
    <TableRow>
      <TableCell className="max-w-[200px]">
        <span className="block truncate font-medium text-sm">{item.nombre}</span>
        {item.principioActivo && (
          <span className="block truncate text-xs text-muted-foreground">
            {item.principioActivo}
            {item.concentracion && ` ${item.concentracion}`}
          </span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-xs capitalize">{item.categoria}</span>
      </TableCell>
      <TableCell className="text-sm tabular-nums">
        {item.cantidadPlanificada}
      </TableCell>
      <TableCell>
        <form ref={formRef}>
          <Input
            className="h-8 w-24 tabular-nums"
            defaultValue={disponible}
            min={0}
            name="cantidadDisponible"
            step={1}
            type="number"
          />
          <input name="nombre" type="hidden" value={item.nombre} />
          <input
            name="observaciones"
            type="hidden"
            value={item.observaciones ?? ""}
          />
        </form>
      </TableCell>
      <TableCell className="text-sm">{item.unidad}</TableCell>
      <TableCell className="max-w-[160px] text-sm text-muted-foreground">
        <span className="block truncate">
          {item.observaciones ?? "—"}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            disabled={isPending}
            onClick={handleSave}
            size="icon"
            title="Guardar cambios"
            variant="ghost"
          >
            <SaveIcon className="size-3.5" />
          </Button>
          <Button
            disabled={isPending}
            onClick={handleDelete}
            size="icon"
            title="Eliminar item"
            variant="ghost"
          >
            <Trash2Icon className="size-3.5 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
