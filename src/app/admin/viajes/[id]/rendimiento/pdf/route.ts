import { getViajeByDocId } from "@/app/admin/viajes/queries";
import {
  getStationPerformanceForTrip,
  type DocenteStationPerformance,
} from "@/lib/docente-station-performance";
import {
  getTripPerformancePdfFileName,
  renderTripPerformancePdf,
} from "@/lib/reports/docente-station-performance-pdf";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stationKeyFromTipo(tipo: string) {
  return Object.entries(stationConfigs).find(
    ([, config]) => config.viajeTipo === tipo,
  )?.[0] as StationKey | undefined;
}

function isPerformance(
  value: DocenteStationPerformance | null,
): value is DocenteStationPerformance {
  return Boolean(value);
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } = await context.params;
  const viajeId = decodeURIComponent(id);
  const viaje = await getViajeByDocId(viajeId);

  if (!viaje) {
    return Response.json({ message: "Viaje no encontrado." }, { status: 404 });
  }

  const performances = (
    await Promise.all(
      viaje.estaciones.map(async (estacion) => {
        const stationKey = stationKeyFromTipo(estacion.tipo);

        if (!stationKey) {
          return null;
        }

        return getStationPerformanceForTrip({
          stationKey,
          viajeId,
        });
      }),
    )
  ).filter(isPerformance);

  if (performances.length === 0) {
    return Response.json(
      { message: "No hay rendimiento para este viaje." },
      { status: 404 },
    );
  }

  const pdf = renderTripPerformancePdf(performances);

  return new Response(pdf, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${getTripPerformancePdfFileName(performances)}"`,
      "Content-Type": "application/pdf",
    },
  });
}
