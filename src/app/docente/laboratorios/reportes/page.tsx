import { StationReportsPage } from "@/components/docente/station-reports-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes | Medicina UNIFRANZ" };

export default function Page() {
  return <StationReportsPage stationKey="laboratorios" />;
}
