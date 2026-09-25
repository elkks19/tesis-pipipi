import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { createViaje } from "@/app/admin/viajes/create/actions";
import { ViajeForm, type ViajeUserOption } from "@/components/forms/viaje-form";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { hasAuthPermission } from "@/lib/auth-permissions";
import { listAuthUsers } from "@/lib/auth-users";

export const metadata: Metadata = {
  title: "Crear viaje",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUsers(): Promise<ViajeUserOption[]> {
  return listAuthUsers();
}

export default async function DocenteCreateViajePage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });
  const canCreateViaje =
    session &&
    (await hasAuthPermission({
      headers: requestHeaders,
      permission: {
        viaje: ["create"],
      },
    }));

  if (!canCreateViaje) {
    redirect("/docente");
  }

  const users = await getUsers();

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl bg-background p-4 shadow-sm ring-1 ring-border/60 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">Docente organizador</p>
            <h1 className="font-heading text-2xl font-semibold">Crear viaje</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">Define fechas, establecimiento y estaciones de trabajo para el equipo.</p>
          </div>
          <Button asChild size="sm" variant="outline"><Link href="/docente"><ArrowLeftIcon data-icon="inline-start" />Volver al panel</Link></Button>
        </div>

        <ViajeForm
          action={createViaje}
          backHref="/docente"
          successRedirectHref="/docente"
          users={users}
        />
      </div>
    </main>
  );
}

