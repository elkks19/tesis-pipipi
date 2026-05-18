import type { Metadata } from "next";
import { FileCheck2Icon } from "lucide-react";

import { PendingHistoriesTable } from "../_components/pending-histories-table";
import { listHistoriasForDiagnostico } from "./queries";

export const metadata: Metadata = {
  title: "Diagnostico",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiagnosticoPageProps = {
  searchParams: Promise<{
    cursor?: string | string[];
    cursors?: string | string[];
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function DiagnosticoPage({
  searchParams,
}: DiagnosticoPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const page = await listHistoriasForDiagnostico({
    cursor,
    query,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Diagnostico</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecciona una historia pendiente de cierre y registra el diagnostico
          codificado CIE-11.
        </p>
      </div>

      <PendingHistoriesTable
        basePath="/estudiante/diagnostico"
        cursor={cursor}
        cursors={cursors}
        emptyMessage="No hay historias pendientes de diagnostico que coincidan con la busqueda."
        filterId="diagnostico-search"
        page={page}
        query={query}
        stationKey="diagnostico"
        statusIcon={<FileCheck2Icon />}
      />
    </div>
  );
}
