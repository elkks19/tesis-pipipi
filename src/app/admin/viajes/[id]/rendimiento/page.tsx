import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ChartNoAxesCombinedIcon, FileTextIcon } from "lucide-react";

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
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-7 pb-10">
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><ChartNoAxesCombinedIcon className="size-4" /> Informe del viaje</p>
          <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Rendimiento por estaciones
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">{viaje.servicio}</span> · {viaje.establecimiento.nombre}
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
              PDF de rendimiento del viaje
            </Link>
          </Button>
        </div>
      </div>

      {performances.length > 0 ? (
        <Tabs defaultValue={performances[0]?.stationKey} className="gap-5">
          <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Estaciones del viaje</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Selecciona una estación para consultar su rendimiento.</p>
              </div>
              <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">{performances.length} estaciones</span>
            </div>
            <TabsList aria-label="Estaciones del viaje" className="!h-auto !w-full !flex-wrap !justify-start gap-2 !rounded-none !bg-transparent !p-0">
                {performances.map(({ performance, stationKey }, index) => (
                  <TabsTrigger className="!h-auto !flex-none !rounded-lg !border !border-border !bg-muted/20 px-3.5 py-2.5 !text-sm !font-medium !whitespace-normal !text-foreground/75 hover:!border-primary/40 hover:!text-foreground data-active:!border-primary/50 data-active:!bg-primary/10 data-active:!text-primary data-active:!shadow-none" key={stationKey} value={stationKey}>
                    <span className="text-xs tabular-nums opacity-65">{String(index + 1).padStart(2, "0")}</span>
                    {performance.station.label}
                  </TabsTrigger>
                ))}
            </TabsList>
          </div>
          {performances.map(({ performance, stationKey }) => (
            <TabsContent className="!mt-0" key={stationKey} value={stationKey}>
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
