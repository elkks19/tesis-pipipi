import { getDocenteStationPerformance } from "@/lib/docente-station-performance";
import {
  getDocenteStationPerformancePdfFileName,
  renderDocenteStationPerformancePdf,
} from "@/lib/reports/docente-station-performance-pdf";
import type { StationKey } from "@/lib/station-histories";

export async function handleDocenteStationPerformancePdf(stationKey: StationKey) {
  const data = await getDocenteStationPerformance(stationKey);

  if (!data?.activeTrip) {
    return Response.json(
      { message: "No hay viaje activo para esta estacion." },
      { status: 404 },
    );
  }

  const pdf = renderDocenteStationPerformancePdf(data);

  return new Response(pdf, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${getDocenteStationPerformancePdfFileName(data)}"`,
      "Content-Type": "application/pdf",
    },
  });
}
