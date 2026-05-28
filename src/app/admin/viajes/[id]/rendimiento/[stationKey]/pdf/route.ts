import {
  getStationPerformanceForTrip,
} from "@/lib/docente-station-performance";
import {
  getDocenteStationPerformancePdfFileName,
  renderDocenteStationPerformancePdf,
} from "@/lib/reports/docente-station-performance-pdf";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isStationKey(value: string): value is StationKey {
  return value in stationConfigs;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
      stationKey: string;
    }>;
  },
) {
  const { id, stationKey: rawStationKey } = await context.params;

  if (!isStationKey(rawStationKey)) {
    return Response.json({ message: "Estacion no encontrada." }, { status: 404 });
  }

  const data = await getStationPerformanceForTrip({
    stationKey: rawStationKey,
    viajeId: decodeURIComponent(id),
  });

  if (!data?.activeTrip) {
    return Response.json(
      { message: "No hay rendimiento para esta estacion." },
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
