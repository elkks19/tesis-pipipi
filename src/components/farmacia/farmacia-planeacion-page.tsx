import Link from "next/link";
import { CalendarDaysIcon, ClipboardListIcon } from "lucide-react";

import { FarmaciaPlaneacionForm } from "@/components/farmacia/farmacia-planeacion-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip, listViajeInventario } from "@/lib/farmacia";
import { addViajeInventarioItem } from "@/lib/farmacia-actions";

type FarmaciaPlaneacionPageProps = {
  mode: "docente" | "estudiante";
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export async function FarmaciaPlaneacionPage({
  mode,
}: FarmaciaPlaneacionPageProps) {
  const userId = await getAuthenticatedUserId();
  const planningTrip = await getFarmaciaPlanningTrip({ mode, userId });

  if (!planningTrip) {
    return (
      <Card className="min-h-[calc(100vh-9rem)] justify-center" size="sm">
        <CardHeader>
          <CardTitle>No hay viaje de Farmacia activo</CardTitle>
          <CardDescription>
            La planeacion aparece cuando estas asignado a Farmacia en un viaje
            activo o proximo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={mode === "docente" ? "/docente" : "/estudiante"}>
              Volver al inicio
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const items = await listViajeInventario(planningTrip.viajeId);
  const action = addViajeInventarioItem.bind(null, planningTrip.viajeId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-muted/45 p-4 ring-1 ring-border/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold">
            Planeacion de inventario
          </h1>
          <p className="text-sm text-muted-foreground">
            Registra lo que se llevara al viaje.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-1.5 ring-1 ring-border/60">
            <ClipboardListIcon className="size-4" />
            <span className="truncate">{planningTrip.establecimiento}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-1.5 ring-1 ring-border/60">
            <CalendarDaysIcon className="size-4" />
            <span>
              {formatDate(planningTrip.fechaEntrada)} - {formatDate(planningTrip.fechaSalida)}
            </span>
          </div>
        </div>
      </div>

      <FarmaciaPlaneacionForm action={action} items={items} />
    </div>
  );
}
