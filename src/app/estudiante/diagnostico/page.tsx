import type { Metadata } from "next";
import { FileCheck2Icon } from "lucide-react";

import { PendingHistoriesTable } from "../_components/pending-histories-table";
import { listHistoriasForDiagnostico } from "./queries";

export const metadata: Metadata = {
  title: "Diagnóstico",
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2 border-b pb-6">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estación clínica · Cierre de historia</span>
        <h1 className="font-heading text-2xl font-semibold">Diagnóstico</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecciona una historia para registrar el diagnóstico CIE-11, el plan de trabajo y la receta.
        </p>
      </div>

      <PendingHistoriesTable
        basePath="/estudiante/diagnostico"
        cursor={cursor}
        cursors={cursors}
        emptyMessage="No hay historias de diagnóstico que coincidan con la búsqueda."
        filterId="diagnostico-search"
        page={page}
        query={query}
        stationKey="diagnostico"
        statusIcon={<FileCheck2Icon />}
      />
    </div>
  );
}
