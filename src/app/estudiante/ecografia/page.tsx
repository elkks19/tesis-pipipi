import type { Metadata } from "next";
import { ImagePlusIcon } from "lucide-react";

import { PendingHistoriesTable } from "../_components/pending-histories-table";
import { listHistoriasForEcografia } from "./queries";

export const metadata: Metadata = {
  title: "Ecografía",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EcografiaPageProps = {
  searchParams: Promise<{
    cursor?: string | string[];
    cursors?: string | string[];
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function EcografiaPage({ searchParams }: EcografiaPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const page = await listHistoriasForEcografia({ cursor, query });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 border-b pb-6">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estación clínica · Estudio complementario</span>
        <h1 className="font-heading text-2xl font-semibold">Ecografía</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecciona una historia con ecografía solicitada y registra sus hallazgos junto a la imagen del estudio.
        </p>
      </div>

      <PendingHistoriesTable
        basePath="/estudiante/ecografia"
        cursor={cursor}
        cursors={cursors}
        emptyMessage="No hay historias con ecografía solicitada que coincidan con la búsqueda."
        filterId="ecografia-search"
        page={page}
        query={query}
        stationKey="ecografia"
        statusIcon={<ImagePlusIcon />}
      />
    </div>
  );
}
