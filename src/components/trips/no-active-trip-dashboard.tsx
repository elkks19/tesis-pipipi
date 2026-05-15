import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  Clock3Icon,
  MapPinIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { AccessHelpDialog } from "@/components/trips/access-help-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FutureStudentTrip } from "@/lib/student-trip-resolution";

type NoActiveTripDashboardProps = {
  canCreateViaje?: boolean;
  mode: "docente" | "estudiante";
  refreshHref: string;
  trips?: FutureStudentTrip[];
  user?: {
    email?: string | null;
    name?: string | null;
  };
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/La_Paz",
  }).format(date);
}

function getTodayValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/La_Paz",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${value.year}-${value.month}-${value.day}`;
}

function getDaysUntil(value: string) {
  const today = new Date(`${getTodayValue()}T00:00:00`);
  const target = new Date(`${value}T00:00:00`);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil((target.getTime() - today.getTime()) / 86_400_000),
  );
}

function getRouteProgress(daysUntil: number | null) {
  if (daysUntil === null) {
    return 8;
  }

  const planningWindowDays = 30;
  const progress = 100 - (daysUntil / planningWindowDays) * 100;

  return Math.min(92, Math.max(8, Math.round(progress)));
}

function getCopy(mode: NoActiveTripDashboardProps["mode"]) {
  if (mode === "docente") {
    return {
      eyebrow: "Panel docente",
      title: "Aun no tienes una estacion activa",
      description:
        "Cuando un viaje asignado este dentro de sus fechas, te enviaremos directo a la estacion donde figuras como docente encargado.",
      assignmentLabel: "Estacion encargada",
      emptyTitle: "Sin viajes docentes programados",
      emptyDescription:
        "Cuando administracion te asigne como encargado de una estacion, aparecera aqui junto con sus fechas y establecimiento.",
    };
  }

  return {
    eyebrow: "Panel estudiante",
    title: "Aun no tienes una estacion activa",
    description:
      "Cuando un viaje asignado este dentro de sus fechas, te enviaremos directo a la estacion donde debes trabajar.",
    assignmentLabel: "Estacion asignada",
    emptyTitle: "Sin viajes estudiantiles programados",
    emptyDescription:
      "Cuando administracion te asigne a una estacion, aparecera aqui junto con sus fechas y establecimiento.",
  };
}

export function NoActiveTripDashboard({
  canCreateViaje = false,
  mode,
  refreshHref,
  trips = [],
  user,
}: NoActiveTripDashboardProps) {
  const copy = getCopy(mode);
  const nextTrips = trips.slice(0, 4);
  const tripCount = trips.length;
  const primaryTrip = nextTrips[0];
  const daysUntil = primaryTrip ? getDaysUntil(primaryTrip.fechaEntrada) : null;

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="animate-in fade-in-0 slide-in-from-bottom-2 overflow-hidden rounded-3xl border bg-background shadow-sm duration-500">
          <div className="grid min-h-[28rem] lg:grid-cols-[minmax(0,1fr)_25rem]">
            <div className="flex flex-col justify-between gap-8 p-5 sm:p-7 lg:p-9">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="rounded-full border bg-muted/30 px-3 py-1">
                    {copy.eyebrow}
                  </span>
                  <span className="rounded-full border bg-muted/30 px-3 py-1">
                    {tripCount > 0 ? "Viaje programado" : "Sin asignacion"}
                  </span>
                </div>

                <div className="flex max-w-3xl flex-col gap-3">
                  <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                    {primaryTrip
                      ? "Tu siguiente viaje ya esta programado"
                      : copy.title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {primaryTrip
                      ? "El acceso a la estacion se habilitara automaticamente cuando el viaje este dentro de sus fechas."
                      : copy.description}
                  </p>
                </div>
              </div>

              <RouteStatus trip={primaryTrip} />

              <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>Sesion:</span>
                <span className="font-medium text-foreground/80">
                  {user?.name || "Usuario sin nombre"}
                </span>
                <span className="min-w-0 break-all">
                  {user?.email || "Correo no disponible"}
                </span>
              </div>
            </div>

            <aside className="border-t bg-muted/20 p-5 sm:p-7 lg:border-l lg:border-t-0">
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="grid gap-3">
                  <StatusMetric
                    icon={<CalendarClockIcon />}
                    label="Viajes asignados"
                    value={String(tripCount)}
                  />
                  <StatusMetric
                    icon={<Clock3Icon />}
                    label="Inicio"
                    value={
                      primaryTrip
                        ? formatDate(primaryTrip.fechaEntrada)
                        : "Sin fecha"
                    }
                  />
                  <StatusMetric
                    icon={<CheckCircle2Icon />}
                    label="Acceso"
                    value={getAccessLabel(daysUntil, tripCount)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <AccessHelpDialog />
                  {canCreateViaje ? (
                    <Button asChild variant="outline">
                      <Link href="/docente/viajes/create">
                        <PlusIcon data-icon="inline-start" />
                        Crear viaje
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild>
                    <Link href={refreshHref}>
                      <RefreshCwIcon data-icon="inline-start" />
                      Revisar nuevamente
                    </Link>
                  </Button>
                  <LogoutButton />
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Siguientes viajes</CardTitle>
              <CardDescription>
                Viajes donde figuras asignado y que todavia no estan activos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {nextTrips.length > 0 ? (
                <div className="grid gap-2">
                  {nextTrips.map((trip, index) => (
                    <TripRow
                      assignmentLabel={copy.assignmentLabel}
                      index={index}
                      key={trip.viajeId}
                      trip={trip}
                    />
                  ))}
                </div>
              ) : (
                <EmptyTripState
                  description={copy.emptyDescription}
                  title={copy.emptyTitle}
                />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Estado actual</CardTitle>
              <CardDescription>
                El sistema mantiene bloqueado el registro hasta que el viaje
                asignado este activo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <StatusLine
                active={tripCount > 0}
                label={tripCount > 0 ? "Asignacion encontrada" : "Sin viaje asignado"}
              />
              <StatusLine
                active={daysUntil === 0}
                label={
                  daysUntil === 0
                    ? "Fechas activas"
                    : "Fechas fuera del rango activo"
                }
              />
              <StatusLine
                active={false}
                label="Acceso a estacion pendiente"
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function getAccessLabel(daysUntil: number | null, tripCount: number) {
  if (tripCount === 0) {
    return "Pendiente";
  }

  if (daysUntil === 0) {
    return "Disponible";
  }

  return "Programado";
}

function RouteStatus({ trip }: { trip?: FutureStudentTrip }) {
  const daysUntil = trip ? getDaysUntil(trip.fechaEntrada) : null;
  const progress = trip ? getRouteProgress(daysUntil) : 8;
  const statusText = trip
    ? daysUntil === 0
      ? "El viaje inicia hoy"
      : `${daysUntil} dia${daysUntil === 1 ? "" : "s"} para iniciar`
    : "Sin destino asignado";

  return (
    <div className="rounded-3xl border bg-muted/20 p-4 sm:p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-background">
              {trip ? <ShieldCheckIcon /> : <XIcon />}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold">
                {trip ? "Ruta hacia tu siguiente viaje" : "Sin viaje asignado"}
              </span>
              <span className="text-sm text-muted-foreground">
                {trip
                  ? `${trip.establecimiento} - ${formatDate(trip.fechaEntrada)}`
                  : "Tu cuenta todavia no aparece en ningun viaje programado."}
              </span>
            </div>
          </div>
          <span className="w-fit rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {statusText}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: trip ? `${progress}%` : "0%" }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Salida</span>
            <span>Inicio del viaje</span>
            <span>Acceso a estacion</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-2xl border bg-background p-3.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
        {icon}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function TripRow({
  assignmentLabel,
  index,
  trip,
}: {
  assignmentLabel: string;
  index: number;
  trip: FutureStudentTrip;
}) {
  return (
    <div
      className="animate-in fade-in-0 slide-in-from-bottom-3 rounded-2xl border bg-background p-4 duration-500"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="truncate text-sm font-semibold">{trip.servicio}</span>
          <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CalendarClockIcon />
              {formatDate(trip.fechaEntrada)} - {formatDate(trip.fechaSalida)}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <MapPinIcon />
              <span className="truncate">{trip.establecimiento}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-muted/40 p-3">
          <span className="text-xs font-medium text-muted-foreground">
            {assignmentLabel}
          </span>
          <span className="truncate text-sm font-medium">
            {trip.estacionTipo ?? "Pendiente de estacion"}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusLine({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
        {active ? <CheckCircle2Icon /> : <XIcon />}
      </span>
      <span className={active ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

function EmptyTripState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 p-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
