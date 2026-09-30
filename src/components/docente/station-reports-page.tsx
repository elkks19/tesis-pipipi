import { StationReportGenerator } from "./station-report-generator";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocenteReportData } from "@/lib/reports/docente-report-data";
import type { StationKey } from "@/lib/station-histories";

export async function StationReportsPage({ stationKey }: { stationKey: StationKey }) {
  const data = await getDocenteReportData(stationKey);
  if (!data) return <Card><CardHeader><CardTitle>Reportes de la estación</CardTitle><CardDescription>Necesitas un viaje activo y una asignación como docente encargado de esta estación para generar reportes.</CardDescription></CardHeader></Card>;
  return <StationReportGenerator options={data.options} />;
}
