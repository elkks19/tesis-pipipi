"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  PillIcon,
  PrinterIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecetaRow } from "@/lib/farmacia";

type RecetasPendientesListProps = {
  canDeliver: boolean;
  canEdit: boolean;
  markAction: (recetaId: string) => Promise<{ ok: boolean; message?: string }>;
  recetas: RecetaRow[];
};

export function RecetasPendientesList({
  canDeliver,
  canEdit,
  markAction,
  recetas,
}: RecetasPendientesListProps) {
  const [optimisticRecetas, addOptimistic] = useOptimistic(
    recetas,
    (state, deliveredId: string) =>
      state.map((r) => (r.id === deliveredId ? { ...r, entregada: true } : r)),
  );
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleDeliver(recetaId: string) {
    startTransition(async () => {
      addOptimistic(recetaId);
      const result = await markAction(recetaId);
      if (result.ok) {
        toast.success(result.message ?? "Receta entregada.");
      } else {
        toast.error(result.message ?? "Error al marcar receta.");
      }
    });
  }

  // Items sin stock: medicamentos de recetas pendientes que no tienen inventarioItemId
  const faltantes = optimisticRecetas
    .filter((r) => !r.entregada)
    .flatMap((r) =>
      r.medicamentos
        .filter((m) => !m.inventarioItemId)
        .map((m) => ({
          cantidad: m.cantidad,
          concentracion: m.concentracion,
          nombre: m.nombre,
          paciente: r.pacienteNombre,
          unidad: m.unidad,
        })),
    );

  return (
    <div className="flex flex-col gap-4">
      {faltantes.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {faltantes.length} medicamento(s) sin stock en inventario
          </span>
          <Button
            onClick={() => printFaltantes(faltantes)}
            size="sm"
            variant="outline"
          >
            <PrinterIcon className="size-3.5" />
            Imprimir faltantes
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Paciente</TableHead>
              <TableHead>Medicamentos</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimisticRecetas.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-28 text-center text-muted-foreground"
                  colSpan={6}
                >
                  No hay recetas registradas para este viaje.
                </TableCell>
              </TableRow>
            ) : (
              optimisticRecetas.map((receta) => {
                const isExpanded = expandedId === receta.id;

                return (
                  <RecetaTableRow
                    key={receta.id}
                    canDeliver={canDeliver}
                    canEdit={canEdit}
                    isExpanded={isExpanded}
                    isPending={isPending}
                    onDeliver={() => handleDeliver(receta.id)}
                    onToggle={() =>
                      setExpandedId(isExpanded ? null : receta.id)
                    }
                    receta={receta}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RecetaTableRow({
  canDeliver,
  canEdit,
  isExpanded,
  isPending,
  onDeliver,
  onToggle,
  receta,
}: {
  canDeliver: boolean;
  canEdit: boolean;
  isExpanded: boolean;
  isPending: boolean;
  onDeliver: () => void;
  onToggle: () => void;
  receta: RecetaRow;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell className="w-8 px-2">
          {isExpanded ? (
            <ChevronUpIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">
          {receta.pacienteNombre}
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">
            {receta.medicamentos.length} medicamento(s)
          </span>
        </TableCell>
        <TableCell className="text-sm">
          {new Date(receta.createdAt).toLocaleDateString("es-BO", {
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            month: "short",
          })}
        </TableCell>
        <TableCell>
          {receta.entregada ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-3.5" />
              Entregada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <ClockIcon className="size-3.5" />
              Pendiente
            </span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {!receta.entregada && canDeliver && (
            <Button
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                onDeliver();
              }}
              size="sm"
              variant="outline"
            >
              <CheckCircle2Icon className="size-3.5" />
              Entregar
            </Button>
          )}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={6} className="p-4">
            <RecetaDetail canEdit={canEdit} receta={receta} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function RecetaDetail({
  canEdit,
  receta,
}: {
  canEdit: boolean;
  receta: RecetaRow;
}) {
  void canEdit;

  return (
    <div className="flex flex-col gap-3">
      {receta.indicacionesGenerales && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Indicaciones: </span>
          {receta.indicacionesGenerales}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicamento</TableHead>
              <TableHead>Dosis</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Duracion</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Via</TableHead>
              <TableHead>Indicaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receta.medicamentos.map((med, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <PillIcon className="size-3.5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{med.nombre}</span>
                      {med.concentracion && (
                        <span className="text-xs text-muted-foreground">
                          {med.concentracion}
                          {med.formaFarmaceutica && ` · ${med.formaFarmaceutica}`}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{med.dosis}</TableCell>
                <TableCell className="text-sm">{med.frecuencia}</TableCell>
                <TableCell className="text-sm">{med.duracion}</TableCell>
                <TableCell className="text-sm">
                  {med.cantidad
                    ? `${med.cantidad} ${med.unidad ?? "unidades"}`
                    : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {med.viaAdministracion ?? "—"}
                </TableCell>
                <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                  {med.indicaciones ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {receta.entregadaAt && (
        <p className="text-xs text-muted-foreground">
          Entregada el{" "}
          {new Date(receta.entregadaAt).toLocaleDateString("es-BO", {
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}

type FaltanteItem = {
  cantidad?: number;
  concentracion?: string;
  nombre: string;
  paciente: string;
  unidad?: string;
};

function printFaltantes(faltantes: FaltanteItem[]) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const rows = faltantes
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 12px;border:1px solid #ddd">${item.nombre}</td>
          <td style="padding:6px 12px;border:1px solid #ddd">${item.concentracion ?? "—"}</td>
          <td style="padding:6px 12px;border:1px solid #ddd">${item.cantidad ?? "—"} ${item.unidad ?? ""}</td>
          <td style="padding:6px 12px;border:1px solid #ddd">${item.paciente}</td>
        </tr>`,
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Medicamentos faltantes en farmacia</title>
      <style>
        body { font-family: sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { color: #666; font-size: 13px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #f5f5f5; text-align: left; padding: 8px 12px; border: 1px solid #ddd; font-size: 13px; }
        td { font-size: 13px; }
      </style>
    </head>
    <body>
      <h1>Medicamentos faltantes en inventario</h1>
      <p>Generado: ${new Date().toLocaleString("es-BO")}</p>
      <table>
        <thead>
          <tr>
            <th>Medicamento</th>
            <th>Concentracion</th>
            <th>Cantidad</th>
            <th>Paciente</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;font-style:italic">
        Estos medicamentos fueron recetados pero no se encontraron en el inventario del viaje.
        Se recomienda informar al paciente o gestionar su adquisicion.
      </p>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
