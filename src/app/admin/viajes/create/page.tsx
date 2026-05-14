import type { Metadata } from "next";

import { ViajeForm, type ViajeUserOption } from "@/components/forms/viaje-form";
import { listAuthUsers } from "@/lib/auth-users";

import { createViaje } from "./actions";

export const metadata: Metadata = {
  title: "Crear viaje",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUsers(): Promise<ViajeUserOption[]> {
  return listAuthUsers();
}

export default async function CreateViajePage() {
  const users = await getUsers();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Crear viaje</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Define fechas, establecimiento y estaciones de trabajo para el equipo.
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          No se pudieron cargar usuarios. Verifica que tu cuenta tenga permisos
          de administrador.
        </div>
      ) : null}

      <ViajeForm
        action={createViaje}
        successRedirectHref="/admin/viajes"
        users={users}
      />
    </div>
  );
}
