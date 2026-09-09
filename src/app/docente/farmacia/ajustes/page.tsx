import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InventarioAjustesTable } from "@/components/farmacia/inventario-ajustes-table";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip, listViajeInventario } from "@/lib/farmacia";
import {
  deleteInventarioItemAction,
  updateInventarioItemAction,
} from "@/lib/farmacia-ajuste-actions";

export const metadata: Metadata = {
  title: "Docente | Farmacia | Ajustes de inventario",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DocenteFarmaciaAjustesPage() {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "docente", userId });

  if (!trip?.active) {
    redirect("/docente/farmacia/planeacion");
  }

  const items = await listViajeInventario(trip.viajeId);

  const boundUpdateAction = updateInventarioItemAction.bind(
    null,
    trip.viajeId,
  );
  const boundDeleteAction = deleteInventarioItemAction.bind(
    null,
    trip.viajeId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Ajustar inventario
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Modifica las cantidades disponibles, corrige datos o elimina items del
          inventario del viaje.
        </p>
      </div>

      <InventarioAjustesTable
        deleteAction={boundDeleteAction}
        items={items}
        updateAction={boundUpdateAction}
      />
    </div>
  );
}
