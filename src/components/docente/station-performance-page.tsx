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

type StationPerformancePageProps = {
  stationKey: StationKey;
};

type StationPerformanceViewProps = {
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
    <Card className="shadow-sm" size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {description ? (
          <CardDescription className="truncate">{description}</CardDescription>
        ) : null}
      </CardHeader>
    </Card>
  );
}

export function StationPerformanceView({
  pdfHref,
  performance,
  title = "Rendimiento de estudiantes",
}: StationPerformanceViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">{title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {performance.station.label} en {performance.activeTrip.servicio} -{" "}
            {performance.activeTrip.establecimiento}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={pdfHref} target="_blank">
            <FileTextIcon data-icon="inline-start" />
            Abrir PDF
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lista de estudiantes</CardTitle>
          <CardDescription>
            Ordenado por registros completados y actividad registrada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="text-right">Historias tocadas</TableHead>
                <TableHead className="text-right">Creados</TableHead>
                <TableHead className="text-right">Editados</TableHead>
                <TableHead className="text-right">Actividad</TableHead>
                <TableHead>Ultima actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performance.rows.length > 0 ? (
                performance.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.email || row.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.registered}
                      {row.updated > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          / {row.updated} edit.
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.touchedHistories}
                    </TableCell>
                    <TableCell className="text-right">
                      <span>{row.historyCreatedActivities}</span>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        H / {row.patientCreatedActivities} P
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.dataUpdatedActivities}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.totalActivities}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        ({row.createdActivities}/{row.updatedActivities})
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(row.lastActivityAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="h-24 text-center text-muted-foreground"
                    colSpan={7}
                  >
                    No hay estudiantes asignados a esta estacion.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
