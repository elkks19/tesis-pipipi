import Link from "next/link";
import { redirect } from "next/navigation";
import { PackagePlusIcon } from "lucide-react";
import { InventarioPlaneacionList } from "@/components/farmacia/inventario-planeacion-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip, listViajeInventario } from "@/lib/farmacia";
import { editarPlaneacionAction } from "@/lib/farmacia-planeacion-actions";

export async function FarmaciaPlaneacionPage({ mode }: { mode: "docente" | "estudiante" }) {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode, userId });
  if (!trip || trip.accessPhase !== "planeacion") redirect(`/${mode}/farmacia/inventario`);
  const items = await listViajeInventario(trip.viajeId);
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2"><Badge variant="secondary">Preparación del viaje</Badge><h1 className="font-heading text-2xl font-semibold">Inventario del viaje</h1><p className="text-sm text-muted-foreground">{trip.establecimiento} · Inicio: {trip.fechaEntrada}</p><p className="max-w-xl text-sm text-muted-foreground">Revisa los productos registrados y edita su preparación. La edición se cierra al comenzar el viaje.</p></div>
      <Button asChild><Link href={`/${mode}/farmacia/entradas`}><PackagePlusIcon data-icon="inline-start" />Registrar entrada</Link></Button>
    </div>
    <InventarioPlaneacionList items={items} editAction={editarPlaneacionAction.bind(null, mode, trip.viajeId)} />
  </div>;
}
