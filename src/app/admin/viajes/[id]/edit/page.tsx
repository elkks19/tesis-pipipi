import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import {
  ViajeForm,
  type ViajeFormValue,
  type ViajeUserOption,
} from "@/components/forms/viaje-form";
import { ViajeInventarioTable } from "@/components/farmacia/viaje-inventario-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listAuthUsers } from "@/lib/auth-users";
import { listViajeInventario } from "@/lib/farmacia";

import { getViajeByDocId } from "../../queries";
import { updateViaje } from "./actions";

export const metadata: Metadata = {
  title: "Editar viaje",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUsers(): Promise<ViajeUserOption[]> {
  return listAuthUsers();
}

function getDefaultValue(viaje: NonNullable<Awaited<ReturnType<typeof getViajeByDocId>>>): ViajeFormValue {
  return {
    establecimiento: {
      contacto: viaje.establecimiento.contacto ?? "",
      direccion: viaje.establecimiento.direccion ?? "",
      nombre: viaje.establecimiento.nombre,
    },
    estaciones: viaje.estaciones.map((estacion, index) => ({
      docenteEncargado: estacion.docenteEncargadoId,
      estudiantes: estacion.estudiantesIds,
      id: `${estacion.tipo}-${index}`,
      tipo: estacion.tipo,
    })),
    fechaEntrada: viaje.fechaEntrada,
    fechaSalida: viaje.fechaSalida,
    servicio: viaje.servicio,
  };
}

export default async function EditViajePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viaje = await getViajeByDocId(decodeURIComponent(id));

  if (!viaje) {
    notFound();
  }

  const [users, inventarioItems] = await Promise.all([
    getUsers(),
    listViajeInventario(viaje.docId),
  ]);
  const action = updateViaje.bind(null, viaje.docId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administración · Coordinación</p>
          <h1 className="font-heading text-2xl font-semibold">Editar viaje</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Ajusta fechas, establecimiento y estaciones antes de que el viaje inicie.
          </p>
        </div>
        <Button asChild size="sm" variant="outline"><Link href="/admin/viajes"><ArrowLeftIcon data-icon="inline-start" />Volver a viajes</Link></Button>
      </div>

      <ViajeForm
        action={action}
        backHref="/admin/viajes"
        defaultValue={getDefaultValue(viaje)}
        successRedirectHref="/admin/viajes"
        submitLabel="Actualizar viaje"
        users={users}
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Inventario actual del viaje</CardTitle>
          <CardDescription>
            Medicamentos, insumos y equipos planificados por Farmacia para esta
            salida. Se muestran aqui para revisar la planeacion sin cambiar de
            pantalla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ViajeInventarioTable
            emptyMessage="Farmacia todavia no planifico inventario para este viaje."
            items={inventarioItems}
          />
        </CardContent>
      </Card>
    </div>
  );
}
