import {
  ActivityIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FileTextIcon,
  TrendingUpIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";

import { StationCategoryBars } from "@/components/docente/station-performance-chart";
import { Button } from "@/components/ui/button";
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
    <Card className="gap-0 rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/30" size="sm">
      <CardHeader className="gap-3 p-4 sm:p-5">
        <CardDescription className="flex items-center gap-2.5 text-xs font-medium uppercase tracking-wide">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</CardTitle>
        {description ? (
          <CardDescription className="truncate">{description}</CardDescription>
        ) : null}
      </CardHeader>
    </Card>
  );
}

export function StationPerformanceView({
  compactTitle = false,
  pdfHref,
  performance,
  title = "Rendimiento de estudiantes",
}: StationPerformanceViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Detalle de estación</p>
          <h1
            className={cn(
              "font-heading font-semibold",
              compactTitle ? "text-xl" : "text-2xl",
            )}
          >
            {title}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {performance.station.label} en {performance.activeTrip.servicio} -{" "}
            {performance.activeTrip.establecimiento}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={pdfHref} target="_blank">
            <FileTextIcon data-icon="inline-start" />
            PDF de {performance.station.label}
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={ClipboardCheckIcon}
          label="Registros"
          value={`${performance.summary.completed}/${performance.summary.requested}`}
        />
        <MetricCard
          icon={TrendingUpIcon}
          label="Avance"
          value={`${performance.summary.completionRate}%`}
        />
        <MetricCard
          icon={UsersRoundIcon}
          label="Estudiantes"
          value={performance.summary.students}
        />
        <MetricCard
          icon={ActivityIcon}
          label="Actividad"
          value={performance.summary.totalActivities}
        />
        <MetricCard
          icon={ClockIcon}
          label="Ediciones"
          value={performance.summary.updates}
        />
      </div>

      <StationCategoryBars
        rows={performance.rows}
        totals={{
          dataUpdates: performance.summary.dataUpdates,
          historiesCreated: performance.summary.historiesCreated,
          patientsCreated: performance.summary.patientsCreated,
        }}
      />

      <Card className="gap-0 overflow-hidden rounded-xl border bg-card shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/15 px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <CardTitle className="text-base">Participación de estudiantes</CardTitle>
            <CardDescription>Ordenado por registros completados y actividad registrada.</CardDescription>
          </div>
          <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            {performance.rows.length} estudiantes
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1040px]">
            <TableHeader className="bg-muted/25 text-xs">
              <TableRow>
                <TableHead className="min-w-56 pl-6">Estudiante</TableHead>
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
                        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
                          {row.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-semibold text-foreground">{row.name}</span>
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
                    No hay estudiantes asignados a esta estación.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
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
