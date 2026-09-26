import { redirect } from "next/navigation";
import { FarmaciaPlaneacionForm } from "@/components/farmacia/farmacia-planeacion-form";
import { InventarioAjustesTable } from "@/components/farmacia/inventario-ajustes-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { canPerformFarmaciaAction, getFarmaciaPlanningTrip, listViajeInventario } from "@/lib/farmacia";
import { addViajeInventarioItem } from "@/lib/farmacia-actions";
import { updateInventarioItemAction } from "@/lib/farmacia-ajuste-actions";

export async function FarmaciaEntradasPage({ mode }: { mode: "docente" | "estudiante" }) {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode, userId });
  if (!trip || !canPerformFarmaciaAction({ mode, permission: "receive", phase: trip.accessPhase })) redirect(`/${mode}/farmacia/inventario`);
  const items = await listViajeInventario(trip.viajeId);
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <div className="flex flex-col gap-1"><h1 className="font-heading text-2xl font-semibold">Entradas de inventario</h1><p className="text-sm text-muted-foreground">Registra un producto o lote nuevo, o incorpora unidades a un lote existente.</p></div>
    <Tabs defaultValue="nuevo"><TabsList><TabsTrigger value="nuevo">Nuevo producto o lote</TabsTrigger><TabsTrigger value="existente">Lote existente</TabsTrigger></TabsList>
      <TabsContent value="nuevo" className="mt-4"><FarmaciaPlaneacionForm mode={mode} action={addViajeInventarioItem.bind(null, mode, trip.viajeId)} /></TabsContent>
      <TabsContent value="existente" className="mt-4"><InventarioAjustesTable intent="entrada" items={items} updateAction={updateInventarioItemAction.bind(null, mode, trip.viajeId)} /></TabsContent>
    </Tabs>
  </div>;
}
