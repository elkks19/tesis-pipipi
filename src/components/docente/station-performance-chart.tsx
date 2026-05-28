"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type PerformanceChartRow = {
  dataUpdatedActivities?: number;
  historyCreatedActivities?: number;
  isAssignedStudent?: boolean;
  name: string;
  patientCreatedActivities?: number;
  registered: number;
  role?: string | null;
  totalActivities: number;
};

type StationPerformanceChartProps = {
  rows: PerformanceChartRow[];
};

type CategoryKey =
  | "historyCreatedActivities"
  | "patientCreatedActivities"
  | "dataUpdatedActivities";

const actorChartConfig = {
  value: {
    color: "var(--primary)",
    label: "Total",
  },
} satisfies ChartConfig;

function shortName(value: string) {
  const [first = "", second = ""] = value.split(" ");

  return `${first} ${second}`.trim() || value;
}

function actorLabel(row: PerformanceChartRow) {
  if (row.role === "docente") {
    return `${shortName(row.name)} (doc.)`;
  }

  if (row.isAssignedStudent === false) {
    return `${shortName(row.name)} (extra)`;
  }

  return shortName(row.name);
}

function chartRows(rows: PerformanceChartRow[], key: CategoryKey) {
  return rows
    .map((row) => ({
      actor: actorLabel(row),
      fullName: row.name,
      value: row[key] ?? 0,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function ActorMetricChart({
  description,
  metricKey,
  rows,
  title,
  total,
}: StationPerformanceChartProps & {
  description: string;
  metricKey: CategoryKey;
  title: string;
  total: number;
}) {
  const data = chartRows(rows, metricKey);
  const chartHeight = Math.max(150, data.length * 34);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle className="flex items-baseline justify-between gap-3">
          <span>{title}</span>
          <span className="text-3xl tabular-nums">{total}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ChartContainer
            className="w-full"
            config={actorChartConfig}
            initialDimension={{ height: chartHeight, width: 480 }}
            style={{ height: chartHeight }}
          >
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              margin={{ bottom: 4, left: 6, right: 34, top: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                axisLine={false}
                dataKey="actor"
                tickLine={false}
                tickMargin={8}
                type="category"
                width={128}
              />
              <XAxis dataKey="value" hide type="number" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const payload = item.payload as {
                        fullName: string;
                      };

                      return (
                        <div className="flex min-w-36 flex-col gap-1">
                          <span className="font-medium">{payload.fullName}</span>
                          <span className="text-muted-foreground">
                            Total: {value}
                          </span>
                        </div>
                      );
                    }}
                    hideLabel
                  />
                }
                cursor={false}
              />
              <Bar dataKey="value" fill="var(--color-value)" radius={6}>
                <LabelList
                  className="fill-foreground"
                  dataKey="value"
                  fontSize={12}
                  position="right"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-36 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
            Sin actividad registrada.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StationCategoryBars({
  rows,
  totals,
}: StationPerformanceChartProps & {
  totals: {
    dataUpdates: number;
    historiesCreated: number;
    patientsCreated: number;
  };
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <ActorMetricChart
        description="Grafico de historias creadas"
        metricKey="historyCreatedActivities"
        rows={rows}
        title="Historias creadas"
        total={totals.historiesCreated}
      />
      <ActorMetricChart
        description="Grafico de pacientes creados"
        metricKey="patientCreatedActivities"
        rows={rows}
        title="Pacientes creados"
        total={totals.patientsCreated}
      />
      <ActorMetricChart
        description="Grafico de datos editados"
        metricKey="dataUpdatedActivities"
        rows={rows}
        title="Datos editados"
        total={totals.dataUpdates}
      />
    </div>
  );
}
