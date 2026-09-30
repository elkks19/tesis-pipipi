import {
  ActivityIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FileTextIcon,
  MapPinIcon,
  TrendingUpIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";

import { StationCategoryBars } from "@/components/docente/station-performance-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { registrationRoleLabel } from "@/lib/registration-author";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDocenteStationPerformance,
  type DocenteStationPerformance,
} from "@/lib/docente-station-performance";
import type { StationKey } from "@/lib/station-histories";
import { cn } from "@/lib/utils";

type StationPerformancePageProps = {
  stationKey: StationKey;
};

type StationPerformanceViewProps = {
  compactTitle?: boolean;
  pdfHref: string;
  performance: DocenteStationPerformance;
  title?: string;
};

const stationKeyToSlug: Record<StationKey, string> = {
  anamnesis: "anamnesis",
  diagnostico: "diagnostico",
  ecografia: "ecografia",
  electrocardiograma: "electrocardiograma",
  espirometria: "espirometria",
  examenFisicoGeneral: "examen-fisico-general",
  examenFisicoSegmentario: "examen-fisico-segmentario",
  farmacia: "farmacia",
  laboratorios: "laboratorios",
};

function formatDate(value?: string) {
  if (!value) {
    return "Sin actividad";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/La_Paz",
  }).format(date);
}

function MetricCard({
  description,
  icon: Icon,
  label,
  value,
}: {
  description?: string;
  icon: typeof TrendingUpIcon;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="gap-3 rounded-2xl border shadow-none" size="sm">
      <CardHeader>
        <CardDescription className="flex items-center justify-between gap-2">
          {label}
          <Icon className="size-4 shrink-0" aria-hidden="true" />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StationPerformanceView({
  compactTitle = false,
  pdfHref,
  performance,
  title = "Rendimiento de la estación",
}: StationPerformanceViewProps) {
  const assignedStudents = performance.rows.filter((row) => row.isAssignedStudent).length;
  const pending = Math.max(0, performance.summary.requested - performance.summary.completed);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><TrendingUpIcon className="size-5" aria-hidden="true" /></span>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Seguimiento docente · {performance.station.label}</p>
          <h1
            className={cn(
              "font-heading font-semibold",
              compactTitle ? "text-xl" : "text-2xl",
            )}
          >
            {title}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {performance.activeTrip.servicio}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />{performance.activeTrip.establecimiento}</p>
        </div>
        </div>
        <Button asChild variant="outline">
          <Link href={pdfHref} target="_blank">
            <FileTextIcon data-icon="inline-start" />
            Descargar informe PDF
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="gap-3 rounded-2xl border border-primary/20 shadow-none sm:col-span-2" size="sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Avance de la estación</CardTitle>
              <Badge variant="secondary"><ClipboardCheckIcon data-icon="inline-start" />{performance.summary.completionRate}% completado</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground"><span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{performance.summary.completed}</span> de {performance.summary.requested} registros completados</p>
            <div className="h-2 overflow-hidden rounded-full bg-primary/10" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, performance.summary.completionRate))}%` }} /></div>
            <p className="text-xs text-muted-foreground">{performance.summary.requested === 0 ? "Todavía no hay registros solicitados." : pending ? `${pending} registros pendientes de completar` : "Todos los registros solicitados están completos."}</p>
          </CardContent>
        </Card>
        <MetricCard
          icon={UsersRoundIcon}
          label="Estudiantes asignados"
          value={assignedStudents}
          description="Equipo de esta estación"
        />
        <MetricCard
          icon={ActivityIcon}
          label="Actividad"
          value={performance.summary.totalActivities}
          description="Movimientos registrados"
        />
        <MetricCard
          icon={ClockIcon}
          label="Ediciones"
          value={performance.summary.updates}
          description="Actualizaciones de datos"
        />
      </div>

      <section className="flex flex-col gap-3" aria-label="Aportes por responsable">
      <div><h2 className="text-base font-semibold">Aportes del equipo</h2><p className="mt-1 text-sm text-muted-foreground">Registros y cambios realizados por estudiantes y docentes.</p></div>
      <StationCategoryBars
        rows={performance.rows}
        totals={{
          dataUpdates: performance.summary.dataUpdates,
          historiesCreated: performance.summary.historiesCreated,
          patientsCreated: performance.summary.patientsCreated,
        }}
      />
      </section>

      <Card className="gap-0 overflow-hidden rounded-2xl border py-0 shadow-none">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-5">
          <div className="flex flex-col gap-1">
            <CardTitle>Participación del equipo</CardTitle>
            <CardDescription>Ordenado por registros completados y actividad registrada.</CardDescription>
          </div>
          <Badge variant="outline">{performance.rows.length} participantes</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto xl:block">
            <Table className="min-w-[920px]">
            <TableHeader className="bg-muted/25 text-xs">
              <TableRow>
                <TableHead className="min-w-56 pl-6">Participante</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="text-right">Historias atendidas</TableHead>
                <TableHead className="text-right">Nuevos registros</TableHead>
                <TableHead className="text-right">Datos editados</TableHead>
                <TableHead className="text-right">Actividad</TableHead>
                <TableHead className="pr-6">Última actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performance.rows.length > 0 ? (
                performance.rows.map((row) => (
                  <TableRow className="odd:bg-muted/5 hover:bg-primary/5" key={row.id}>
                    <TableCell className="py-4 pl-6">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar aria-hidden="true"><AvatarFallback>{row.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-semibold text-foreground">{row.name}</span>
                          <Badge variant="secondary">{registrationRoleLabel(row.role)}</Badge>
                          <span className="max-w-60 truncate text-xs text-muted-foreground" title={row.email || row.id}>
                            {row.email || row.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex min-w-9 justify-center rounded-md border bg-background px-2 py-1 font-semibold text-foreground">{row.registered}</span>
                      {row.updated > 0 ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {row.updated} editados
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.touchedHistories}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium text-foreground">{row.historyCreatedActivities} historias</span>
                      <span className="block text-xs text-muted-foreground">{row.patientCreatedActivities} pacientes</span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.dataUpdatedActivities}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-semibold text-foreground">{row.totalActivities}</span>
                      <span className="block text-xs text-muted-foreground" title="Actividades creadas / actividades actualizadas">
                        {row.createdActivities} nuevas · {row.updatedActivities} cambios
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap pr-6 text-muted-foreground">{formatDate(row.lastActivityAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="h-24 text-center text-muted-foreground"
                    colSpan={7}
                  >
                    No hay participantes para mostrar en esta estación.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </div>
          <div className="grid divide-y xl:hidden">
            {performance.rows.map((row) => (
              <article className="flex flex-col gap-4 p-4 sm:p-5" key={row.id}>
                <div className="flex items-start gap-3">
                  <Avatar aria-hidden="true"><AvatarFallback>{row.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-1"><h3 className="break-words text-sm font-semibold">{row.name}</h3><p className="break-all text-xs text-muted-foreground">{row.email || "Sin correo registrado"}</p></div>
                  <Badge variant="secondary">{registrationRoleLabel(row.role)}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Registros completados</dt><dd className="mt-1 font-semibold tabular-nums">{row.registered}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Historias atendidas</dt><dd className="mt-1 font-semibold tabular-nums">{row.touchedHistories}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Datos editados</dt><dd className="mt-1 font-semibold tabular-nums">{row.dataUpdatedActivities}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Actividad total</dt><dd className="mt-1 font-semibold tabular-nums">{row.totalActivities}</dd></div>
                </dl>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Nuevos: {row.historyCreatedActivities} historias · {row.patientCreatedActivities} pacientes</span><span>Última actividad: {formatDate(row.lastActivityAt)}</span></div>
              </article>
            ))}
            {!performance.rows.length ? <p className="p-6 text-center text-sm text-muted-foreground">No hay participantes para mostrar en esta estación.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export async function StationPerformancePage({
  stationKey,
}: StationPerformancePageProps) {
  const performance = await getDocenteStationPerformance(stationKey);

  if (!performance?.activeTrip) {
    return (
      <div className="flex flex-col gap-2 rounded-3xl border border-dashed bg-muted/20 p-8 text-center">
        <p className="font-medium">Sin viaje activo para esta estacion</p>
        <p className="text-sm text-muted-foreground">
          El rendimiento se calcula con el viaje actual asignado al docente.
        </p>
      </div>
    );
  }

  return (
    <StationPerformanceView
      pdfHref={`/docente/${stationKeyToSlug[stationKey]}/rendimiento/pdf`}
      performance={performance}
    />
  );
}
