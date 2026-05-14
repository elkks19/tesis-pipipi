import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  Clock3Icon,
  MapPinIcon,
  PlaneIcon,
  RefreshCwIcon,
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
import { Separator } from "@/components/ui/separator";
import type { FutureStudentTrip } from "@/lib/student-trip-resolution";

type NoActiveTripDashboardProps = {
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

function getFlightProgress(daysUntil: number | null) {
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
  mode,
  refreshHref,
  trips = [],
  user,
}: NoActiveTripDashboardProps) {
  const copy = getCopy(mode);
  const nextTrips = trips.slice(0, 4);
  const tripCount = trips.length;
  const primaryTrip = nextTrips[0];

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <FlightProgress trip={primaryTrip} />

        <section className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-4xl border bg-background p-4 shadow-sm duration-500 sm:p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center xl:grid-cols-[minmax(0,1fr)_30rem]">
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {copy.eyebrow}
              </span>
              <h1 className="max-w-3xl font-heading text-2xl font-semibold leading-tight sm:text-3xl">
                {copy.title}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground lg:max-w-2xl xl:max-w-3xl">
                {copy.description}
              </p>
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

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <StatusMetric
                icon={<CalendarClockIcon />}
                label="Viajes"
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
                value={tripCount > 0 ? "Programado" : "Pendiente"}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Siguientes viajes</h2>
              <p className="text-sm text-muted-foreground">
                Estos son los viajes donde ya figuras asignado y que todavia no
                estan activos.
              </p>
            </div>

            {nextTrips.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
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
              <Card
                className="animate-in fade-in-0 slide-in-from-bottom-2 shadow-sm duration-500"
                size="sm"
              >
                <CardHeader>
                  <CardTitle>{copy.emptyTitle}</CardTitle>
                  <CardDescription>{copy.emptyDescription}</CardDescription>
                </CardHeader>
              </Card>
            )}
          </section>

          <aside className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <AccessHelpDialog />
              <Button asChild>
                <Link href={refreshHref}>
                  <RefreshCwIcon data-icon="inline-start" />
                  Revisar nuevamente
                </Link>
              </Button>
              <LogoutButton />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function FlightProgress({ trip }: { trip?: FutureStudentTrip }) {
  const daysUntil = trip ? getDaysUntil(trip.fechaEntrada) : null;
  const progress = trip ? getFlightProgress(daysUntil) : 8;
  const curveProgress = trip ? progress : 50;
  const normalizedProgress = Math.max(0, Math.min(1, (curveProgress - 8) / 84));
  const planeLeft = 8 + normalizedProgress * 84;
  const planeTop = 72 - Math.sin(normalizedProgress * Math.PI) * 42;
  const statusText = trip
    ? daysUntil === 0
      ? "El viaje inicia hoy"
      : `${daysUntil} dia${daysUntil === 1 ? "" : "s"} para despegar`
    : "Sin destino asignado";

  return (
    <section className="animate-in fade-in-0 slide-in-from-bottom-4 overflow-hidden rounded-4xl border bg-background shadow-sm duration-500">
      <div className="flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold">
              {trip ? "Vuelo hacia tu siguiente viaje" : "Sin vuelo asignado"}
            </span>
            <span className="text-sm text-muted-foreground">
              {trip
                ? `${trip.establecimiento} - ${formatDate(trip.fechaEntrada)}`
                : "Tu cuenta todavia no aparece en ningun viaje programado."}
            </span>
          </div>
          <span className="rounded-2xl border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {statusText}
          </span>
        </div>

        <div className="relative h-56 overflow-hidden rounded-4xl border bg-muted/20 sm:h-72">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <path
              d="M 8 72 Q 50 18 92 72"
              fill="none"
              pathLength={100}
              stroke="currentColor"
              strokeDasharray="4 4"
              strokeWidth="0.8"
              className="text-muted-foreground/35"
            />
            {trip ? (
              <path
                d="M 8 72 Q 50 18 92 72"
                fill="none"
                pathLength={100}
                stroke="currentColor"
                strokeDasharray={`${progress} ${100 - progress}`}
                strokeWidth="1.2"
                className="text-primary transition-all duration-700"
              />
            ) : null}
          </svg>

          <div className="absolute left-[8%] top-[72%] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40" />
          <div className="absolute left-[92%] top-[72%] size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-sm" />
          <div className="absolute bottom-4 left-5 right-5 flex justify-between text-xs text-muted-foreground">
            <span>Salida</span>
            <span>{trip ? "Destino" : "Sin destino"}</span>
          </div>
          <div
            className="absolute flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl border bg-background shadow-md transition-all duration-700 sm:size-20"
            style={{ left: `${planeLeft}%`, top: `${planeTop}%` }}
          >
            <PlaneIcon className="rotate-45" />
            {!trip ? (
              <span className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full border bg-destructive text-destructive-foreground shadow-sm">
                <XIcon />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
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
    <div className="flex min-w-0 gap-3 rounded-3xl border bg-muted/20 p-3.5 lg:bg-background xl:bg-muted/20">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-background">
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
    <Card
      className="animate-in fade-in-0 slide-in-from-bottom-3 shadow-sm duration-500"
      size="sm"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <CardHeader>
        <CardTitle className="truncate">{trip.servicio}</CardTitle>
        <CardDescription className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <CalendarClockIcon />
            {formatDate(trip.fechaEntrada)} - {formatDate(trip.fechaSalida)}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <MapPinIcon />
            <span className="truncate">{trip.establecimiento}</span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Separator />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {assignmentLabel}
          </span>
          <span className="text-sm">
            {trip.estacionTipo ?? "Pendiente de estacion"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
