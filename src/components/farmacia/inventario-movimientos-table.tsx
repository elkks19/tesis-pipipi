"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InventarioMovimiento, ViajeInventarioItem } from "@/lib/schema";

export function InventarioMovimientosTable({ items, movements }: { items: ViajeInventarioItem[]; movements: Array<PouchDB.Core.ExistingDocument<InventarioMovimiento>> }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("todos");
  const names = useMemo(() => new Map(items.map((item) => [item.id, item.nombre])), [items]);
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const filtered = movements.filter((movement) => {
    if (type !== "todos" && movement.tipo !== type) return false;
    if (!normalizedQuery) return true;
    return `${names.get(movement.inventarioItemId) ?? ""} ${movement.motivo}`.toLocaleLowerCase("es").includes(normalizedQuery);
  });

  return <div className="flex flex-col gap-3">
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
      <div className="relative"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar item o motivo" type="search" value={query} /></div>
      <Select onValueChange={setType} value={type}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
        <SelectItem value="todos">Todos los movimientos</SelectItem>
        <SelectItem value="entrada">Entradas</SelectItem>
        <SelectItem value="dispensacion">Dispensaciones</SelectItem>
        <SelectItem value="entrega_insumo">Entregas de insumo</SelectItem>
        <SelectItem value="ajuste">Ajustes</SelectItem>
        <SelectItem value="devolucion">Devoluciones</SelectItem>
        <SelectItem value="merma">Mermas</SelectItem>
      </SelectGroup></SelectContent></Select>
    </div>
    <div className="overflow-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Item</TableHead><TableHead>Tipo</TableHead><TableHead>Cantidad</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader><TableBody>
      {filtered.length > 0 ? filtered.map((movement) => <TableRow key={movement.id}><TableCell>{new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(movement.createdAt))}</TableCell><TableCell className="font-medium">{names.get(movement.inventarioItemId) ?? "Item no disponible"}</TableCell><TableCell className="capitalize">{movement.tipo.replace("_", " ")}</TableCell><TableCell className="tabular-nums">{movement.cantidad > 0 ? "+" : ""}{movement.cantidad}</TableCell><TableCell className="text-muted-foreground">{movement.motivo}</TableCell></TableRow>) : <TableRow><TableCell className="h-24 text-center text-muted-foreground" colSpan={5}>No hay movimientos con estos filtros.</TableCell></TableRow>}
    </TableBody></Table></div>
  </div>;
}
