import { redirect } from "next/navigation";
import { InsumosEntregados } from "@/components/farmacia/insumos-entregados";
import { InventarioMovimientosTable } from "@/components/farmacia/inventario-movimientos-table";
import { RecetasPendientesList } from "@/components/farmacia/recetas-pendientes-list";
import { ViajeInventarioTable } from "@/components/farmacia/viaje-inventario-table";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip, listInsumoEntregas, listInventarioMovimientos, listViajeInventario, listViajeRecetasPage } from "@/lib/farmacia";
import { dispensarRecetaAction, loadRecetasPageAction, registrarInsumoEntregaAction } from "@/lib/farmacia-inventario-actions";

type View = "inventario" | "recetas" | "insumos" | "movimientos";
const views = {
  inventario: { title: "Inventario del viaje", description: "Consulta los productos, lotes y existencias disponibles." },
  recetas: { title: "Entrega de recetas", description: "Busca una receta y registra la entrega completa o parcial de sus medicamentos." },
  insumos: { title: "Entrega de insumos", description: "Registra las entregas y consulta los insumos utilizados durante el viaje." },
  movimientos: { title: "Movimientos de inventario", description: "Consulta las entradas, entregas y correcciones registradas para el viaje." },
};
export async function FarmaciaInventarioPage({ mode, view = "inventario" }: { mode: "docente" | "estudiante"; view?: View }) {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode, userId });
  if (!trip) return <Card><CardHeader><CardTitle>No hay un viaje de Farmacia disponible</CardTitle><CardDescription>El contenido aparece cuando tienes un viaje asignado.</CardDescription></CardHeader></Card>;
  if (trip.accessPhase === "planeacion") redirect(`/${mode}/farmacia/planeacion`);
  const items = await listViajeInventario(trip.viajeId);
  const canOperate = trip.accessPhase === "activo";
  let content;
  if (view === "recetas") {
    const page = await listViajeRecetasPage({ viajeId: trip.viajeId });
    content = <RecetasPendientesList canDeliver={canOperate} canEdit={mode === "docente"} dispenseAction={dispensarRecetaAction.bind(null, mode, trip.viajeId)} inventory={items.filter((item) => item.categoria === "medicamento")} initialPage={page} key={page.rows.map((r) => `${r.id}:${r.estado}:${r.cantidadesEntregadas.join("-")}`).join("|")} loadPageAction={loadRecetasPageAction.bind(null, mode, trip.viajeId)} />;
  } else if (view === "insumos") {
    const entregas = await listInsumoEntregas(trip.viajeId);
    content = <InsumosEntregados canRegister={canOperate} entregas={entregas} insumos={items.filter((item) => item.categoria !== "medicamento")} registrarAction={registrarInsumoEntregaAction.bind(null, mode, trip.viajeId)} />;
  } else if (view === "movimientos") {
    content = <InventarioMovimientosTable items={items} movements={await listInventarioMovimientos(trip.viajeId)} />;
  } else {
    content = <ViajeInventarioTable emptyMessage="No hay productos registrados para este viaje." items={items} />;
  }
  return <div className="flex min-w-0 flex-col gap-5">
    <div className="flex flex-col gap-2"><Badge variant="secondary">{canOperate ? "Viaje en curso" : "Solo consulta"} · {trip.establecimiento}</Badge><h1 className="font-heading text-2xl font-semibold">{views[view].title}</h1><p className="max-w-2xl text-sm text-muted-foreground">{views[view].description}</p></div>
    {content}
  </div>;
}
