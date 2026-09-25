import { HistoryIcon, PackageIcon, PillIcon, SyringeIcon } from "lucide-react";

import { InsumosEntregados } from "@/components/farmacia/insumos-entregados";
import { InventarioMovimientosTable } from "@/components/farmacia/inventario-movimientos-table";
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
  listInventarioMovimientos,
  listViajeInventario,
  listViajeRecetasPage,
} from "@/lib/farmacia";
import {
  dispensarRecetaAction,
  loadRecetasPageAction,
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

  const [items, recetasPage, entregas, movimientos] = await Promise.all([
    listViajeInventario(planningTrip.viajeId),
    listViajeRecetasPage({ viajeId: planningTrip.viajeId }),
    listInsumoEntregas(planningTrip.viajeId),
    listInventarioMovimientos(planningTrip.viajeId),
  ]);

  const canAccess = userId
    ? await canAccessFarmaciaTrip({ userId, viajeId: planningTrip.viajeId })
    : false;

  const boundDispenseAction = dispensarRecetaAction.bind(
    null,
    mode,
    planningTrip.viajeId,
  );

  const boundInsumoAction = registrarInsumoEntregaAction.bind(
    null,
    planningTrip.viajeId,
  );
  const boundLoadRecetasAction = loadRecetasPageAction.bind(
    null,
    mode,
    planningTrip.viajeId,
  );

  const insumos = items.filter((i) => i.categoria !== "medicamento");
  const canOperate = canAccess && planningTrip.accessPhase === "activo";

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Inventario del viaje
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {planningTrip.accessPhase === "cerrado" ? "Viaje cerrado: consulta de recetas, movimientos y existencias finales." : planningTrip.accessPhase === "conciliacion" ? "Conciliacion posterior al viaje y revision de existencias." : "Recetas, insumos entregados y stock disponible."}
        </p>
      </div>

      <Tabs defaultValue="recetas">
        <TabsList>
          <TabsTrigger value="recetas">
            <PillIcon className="size-3.5" />
            Recetas
          </TabsTrigger>
          <TabsTrigger value="insumos">
            <SyringeIcon className="size-3.5" />
            Insumos
          </TabsTrigger>
          <TabsTrigger value="stock">
            <PackageIcon className="size-3.5" />
            Stock ({items.length})
          </TabsTrigger>
          <TabsTrigger value="movimientos">
            <HistoryIcon className="size-3.5" />
            Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recetas" className="mt-4">
          <RecetasPendientesList
            canDeliver={canOperate}
            canEdit={mode === "docente"}
            dispenseAction={boundDispenseAction}
            inventory={items.filter((item) => item.categoria === "medicamento")}
            initialPage={recetasPage}
            key={recetasPage.rows.map((receta) => `${receta.id}:${receta.estado}:${receta.cantidadesEntregadas.join("-")}`).join("|")}
            loadPageAction={boundLoadRecetasAction}
          />
        </TabsContent>

        <TabsContent value="insumos" className="mt-4">
          <InsumosEntregados
            canRegister={canOperate}
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

        <TabsContent value="movimientos" className="mt-4">
          <InventarioMovimientosTable items={items} movements={movimientos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
