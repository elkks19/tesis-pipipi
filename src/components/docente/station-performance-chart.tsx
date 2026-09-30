import { ClipboardListIcon, PencilLineIcon, UserPlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registrationRoleLabel } from "@/lib/registration-author";
import type { AuthRole } from "@/lib/auth-role-values";

type PerformanceChartRow = {
  id: string;
  dataUpdatedActivities?: number;
  historyCreatedActivities?: number;
  name: string;
  patientCreatedActivities?: number;
  role?: AuthRole | null;
};
type CategoryKey = "historyCreatedActivities" | "patientCreatedActivities" | "dataUpdatedActivities";

function ActorMetricChart({ rows, metricKey, title, total, icon: Icon }: {
  rows: PerformanceChartRow[];
  metricKey: CategoryKey;
  title: string;
  total: number;
  icon: typeof ClipboardListIcon;
}) {
  const contributors = rows.filter((row) => (row[metricKey] ?? 0) > 0)
    .sort((a, b) => (b[metricKey] ?? 0) - (a[metricKey] ?? 0));
  return (
    <Card className="gap-4 rounded-2xl border shadow-none" size="sm">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{total}</span>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Distribución por responsable</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {contributors.length ? (
          <ol className="flex flex-col gap-4">
            {contributors.slice(0, 10).map((row) => {
              const value = row[metricKey] ?? 0;
              const share = total > 0 ? Math.min(100, value / total * 100) : 0;
              return (
                <li className="flex flex-col gap-2" key={row.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="break-words text-sm font-medium">{row.name}</span>
                      <Badge variant="outline">{registrationRoleLabel(row.role)}</Badge>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums">{value}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">{Math.round(share)}%</p>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary/10" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        ) : <p className="py-5 text-sm text-muted-foreground">Aún no hay actividad en esta categoría.</p>}
        {contributors.length > 0 ? <p className="text-xs text-muted-foreground">{contributors.length > 10 ? "Se muestran los 10 mayores aportes. " : ""}Porcentaje del total de {title.toLowerCase()}.</p> : null}
      </CardContent>
    </Card>
  );
}

export function StationCategoryBars({ rows, totals }: {
  rows: PerformanceChartRow[];
  totals: { dataUpdates: number; historiesCreated: number; patientsCreated: number };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ActorMetricChart icon={ClipboardListIcon} metricKey="historyCreatedActivities" rows={rows} title="Historias creadas" total={totals.historiesCreated} />
      <ActorMetricChart icon={UserPlusIcon} metricKey="patientCreatedActivities" rows={rows} title="Pacientes registrados" total={totals.patientsCreated} />
      <ActorMetricChart icon={PencilLineIcon} metricKey="dataUpdatedActivities" rows={rows} title="Datos editados" total={totals.dataUpdates} />
    </div>
  );
}
