import { handleStationReport } from "@/app/docente/_lib/station-report-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleStationReport(request, "ecografia");
}
