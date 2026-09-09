import { PackageIcon, PillIcon, SyringeIcon } from "lucide-react";

import { InsumosEntregados } from "@/components/farmacia/insumos-entregados";
import { RecetasPendientesList } from "@/components/farmacia/recetas-pendientes-list";
import { ViajeInventarioTable } from "@/components/farmacia/viaje-inventario-table";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import {
  canAccessFarmaciaTrip,
  getFarmaciaPlanningTrip,
  listInsumoEntregas,
  listViajeInventario,
  listViajeRecetas,
} from "@/lib/farmacia";
import {
  markRecetaEntregadaAction,
  registrarInsumoEntregaAction,
} from "@/lib/farmacia-inventario-actions";

type FarmaciaInventarioPageProps = {
  mode: "docente" | "estudiante";
};

export async function FarmaciaInventarioPage({
  mode,
}: FarmaciaInventarioPageProps) {
  const userId = await getAuthenticatedUserId();
  const planningTrip = await getFarmaciaPlanningTrip({ mode, userId });

  if (!planningTrip) {
    return (
      <Card className="min-h-[calc(100vh-9rem)] justify-center" size="sm">
        <CardHeader>
          <CardTitle>No hay viaje de Farmacia activo</CardTitle>
          <CardDescription>
            El inventario y recetas aparecen cuando el viaje esta activo.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [items, recetas, entregas] = await Promise.all([
    listViajeInventario(planningTrip.viajeId),
    listViajeRecetas(planningTrip.viajeId),
    listInsumoEntregas(planningTrip.viajeId),
  ]);

  const canAccess = userId
    ? await canAccessFarmaciaTrip({ userId, viajeId: planningTrip.viajeId })
    : false;

  const boundMarkAction = markRecetaEntregadaAction.bind(
    null,
    planningTrip.viajeId,
  );

  const boundInsumoAction = registrarInsumoEntregaAction.bind(
    null,
    planningTrip.viajeId,
  );

  const pendingCount = recetas.filter((r) => !r.entregada).length;
  const insumos = items.filter((i) => i.categoria !== "medicamento");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Inventario del viaje
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Recetas, insumos entregados y stock disponible.
        </p>
      </div>

      <Tabs defaultValue="recetas">
        <TabsList>
          <TabsTrigger value="recetas">
            <PillIcon className="size-3.5" />
            Recetas{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="insumos">
            <SyringeIcon className="size-3.5" />
            Insumos
          </TabsTrigger>
          <TabsTrigger value="stock">
            <PackageIcon className="size-3.5" />
            Stock ({items.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recetas" className="mt-4">
          <RecetasPendientesList
            canDeliver={canAccess}
            canEdit={mode === "docente"}
            markAction={boundMarkAction}
            recetas={recetas}
          />
        </TabsContent>

        <TabsContent value="insumos" className="mt-4">
          <InsumosEntregados
            entregas={entregas}
            insumos={insumos}
            registrarAction={boundInsumoAction}
          />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <ViajeInventarioTable
            emptyMessage="No hay items en el inventario del viaje."
            items={items}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
