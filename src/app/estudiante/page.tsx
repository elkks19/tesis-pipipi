import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClockIcon, MapPinIcon, RouteIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { resolveStudentTripRoute } from "./student-trip-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EstudiantePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const resolution = await resolveStudentTripRoute(session?.user).catch(
    () => ({}) as Awaited<ReturnType<typeof resolveStudentTripRoute>>,
  );

  if (resolution.redirectTo) {
    redirect(resolution.redirectTo);
  }

  const futureTrip = resolution.futureTrip;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-muted">
            <RouteIcon />
          </div>
          <CardTitle>No hay un viaje activo</CardTitle>
          <CardDescription>
            Tu cuenta no esta asignada a una estacion dentro de las fechas de
            un viaje activo. Cuando el viaje este en curso, esta pagina te
            enviara a la estacion que corresponda.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {futureTrip ? (
            <div className="grid gap-3 rounded-3xl border bg-background p-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <CalendarClockIcon />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">Proximo viaje</span>
                  <span className="text-sm text-muted-foreground">
                    {futureTrip.fechaEntrada} al {futureTrip.fechaSalida}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPinIcon />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {futureTrip.establecimiento}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {futureTrip.servicio}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/estudiante">Revisar nuevamente</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Cambiar de cuenta</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
