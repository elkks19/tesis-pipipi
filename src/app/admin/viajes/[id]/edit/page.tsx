import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  ViajeForm,
  type ViajeFormValue,
  type ViajeUserOption,
} from "@/components/forms/viaje-form";
import { listAuthUsers } from "@/lib/auth-users";

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

  const users = await getUsers();
  const action = updateViaje.bind(null, viaje.docId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Editar viaje</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ajusta fechas, establecimiento y estaciones antes de que el viaje
          inicie.
        </p>
      </div>

      <ViajeForm
        action={action}
        defaultValue={getDefaultValue(viaje)}
        successRedirectHref="/admin/viajes"
        submitLabel="Actualizar viaje"
        users={users}
      />
    </div>
  );
}
