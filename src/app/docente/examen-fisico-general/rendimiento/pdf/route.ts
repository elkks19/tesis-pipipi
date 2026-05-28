import { handleDocenteStationPerformancePdf } from "@/app/docente/_lib/station-performance-pdf-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handleDocenteStationPerformancePdf("examenFisicoGeneral");
}
