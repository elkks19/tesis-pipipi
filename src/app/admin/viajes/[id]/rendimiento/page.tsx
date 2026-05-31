import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

import { getViajeByDocId } from "@/app/admin/viajes/queries";
import { StationPerformanceView } from "@/components/docente/station-performance-page";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getStationPerformanceForTrip,
  type DocenteStationPerformance,
} from "@/lib/docente-station-performance";
import { stationConfigs, type StationKey } from "@/lib/station-histories";

type AdminViajeRendimientoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function stationKeyFromTipo(tipo: string) {
  return Object.entries(stationConfigs).find(
    ([, config]) => config.viajeTipo === tipo,
  )?.[0] as StationKey | undefined;
}

function getStationPdfHref(viajeId: string, stationKey: StationKey) {
  return `/admin/viajes/${encodeURIComponent(viajeId)}/rendimiento/${stationKey}/pdf`;
}

function getGeneralPdfHref(viajeId: string) {
  return `/admin/viajes/${encodeURIComponent(viajeId)}/rendimiento/pdf`;
}

export default async function AdminViajeRendimientoPage({
  params,
}: AdminViajeRendimientoPageProps) {
  const { id } = await params;
  const viajeId = decodeURIComponent(id);
  const viaje = await getViajeByDocId(viajeId);

  if (!viaje) {
    notFound();
  }

  const performances = (
    await Promise.all(
      viaje.estaciones.map(async (estacion) => {
        const stationKey = stationKeyFromTipo(estacion.tipo);

        if (!stationKey) {
          return null;
        }

        const performance = await getStationPerformanceForTrip({
          stationKey,
          viajeId,
        });

        return performance
          ? {
              performance,
              stationKey,
            }
          : null;
      }),
    )
  ).filter(
    (
      item,
    ): item is {
      performance: DocenteStationPerformance;
      stationKey: StationKey;
    } => Boolean(item),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="sticky top-14 z-10 flex flex-col gap-4 border-b bg-background py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">
            Rendimiento por estaciones
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {viaje.servicio} - {viaje.establecimiento.nombre}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/viajes">
              <ArrowLeftIcon data-icon="inline-start" />
              Volver a viajes
            </Link>
          </Button>
          <Button asChild>
            <Link href={getGeneralPdfHref(viajeId)} target="_blank">
              <FileTextIcon data-icon="inline-start" />
              PDF general
            </Link>
          </Button>
        </div>
      </div>

      {performances.length > 0 ? (
        <Tabs defaultValue={performances[0]?.stationKey}>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Estacion a revisar
            </p>
            <div className="overflow-x-auto pb-1">
              <TabsList className="w-max">
                {performances.map(({ performance, stationKey }) => (
                  <TabsTrigger key={stationKey} value={stationKey}>
                    {performance.station.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
          {performances.map(({ performance, stationKey }) => (
            <TabsContent className="mt-5" key={stationKey} value={stationKey}>
              <StationPerformanceView
                compactTitle
                pdfHref={getStationPdfHref(viajeId, stationKey)}
                performance={performance}
                title={performance.station.label}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No hay estaciones configuradas para calcular rendimiento.
        </div>
      )}
    </div>
  );
}
