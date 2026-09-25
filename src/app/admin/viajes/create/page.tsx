import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { ViajeForm, type ViajeUserOption } from "@/components/forms/viaje-form";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Administración · Coordinación</p>
          <h1 className="font-heading text-2xl font-semibold">Crear viaje</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Define fechas, establecimiento y estaciones de trabajo para el equipo.
          </p>
        </div>
        <Button asChild size="sm" variant="outline"><Link href="/admin/viajes"><ArrowLeftIcon data-icon="inline-start" />Volver a viajes</Link></Button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          No se pudieron cargar usuarios. Verifica que tu cuenta tenga permisos
          de administrador.
        </div>
      ) : null}

      <ViajeForm
        action={createViaje}
        backHref="/admin/viajes"
        successRedirectHref="/admin/viajes"
        users={users}
      />
    </div>
  );
}
