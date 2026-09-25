import type { Metadata } from "next";
import { HeartPulseIcon } from "lucide-react";

import { PendingHistoriesTable } from "../_components/pending-histories-table";
import { listHistoriasForElectrocardiograma } from "./queries";

export const metadata: Metadata = {
  title: "Electrocardiograma",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ElectrocardiogramaPageProps = {
  searchParams: Promise<{
    cursor?: string | string[];
    cursors?: string | string[];
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ElectrocardiogramaPage({ searchParams }: ElectrocardiogramaPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const page = await listHistoriasForElectrocardiograma({ cursor, query });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 border-b pb-6">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estación clínica · Estudio complementario</span>
        <h1 className="font-heading text-2xl font-semibold">Electrocardiograma</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecciona una historia con electrocardiograma solicitado y registra su lectura cardíaca.
        </p>
      </div>

      <PendingHistoriesTable
        basePath="/estudiante/electrocardiograma"
        cursor={cursor}
        cursors={cursors}
        emptyMessage="No hay historias con electrocardiograma solicitado que coincidan con la búsqueda."
        filterId="electrocardiograma-search"
        page={page}
        query={query}
        stationKey="electrocardiograma"
        statusIcon={<HeartPulseIcon />}
      />
    </div>
  );
}
