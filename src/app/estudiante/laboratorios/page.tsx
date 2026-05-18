import type { Metadata } from "next";
import { FlaskConicalIcon } from "lucide-react";

import { PendingHistoriesTable } from "../_components/pending-histories-table";
import { listPendingComplementaryExamHistories } from "../_lib/station-history-queries";

export const metadata: Metadata = {
  title: "Laboratorios",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LaboratoriosPageProps = {
  searchParams: Promise<{
    cursor?: string | string[];
    cursors?: string | string[];
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LaboratoriosPage({
  searchParams,
}: LaboratoriosPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const page = await listPendingComplementaryExamHistories({
    cursor,
    examKey: "laboratorios",
    query,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Laboratorios</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecciona una historia con laboratorios solicitados y registra sus
          resultados.
        </p>
      </div>

      <PendingHistoriesTable
        basePath="/estudiante/laboratorios"
        cursor={cursor}
        cursors={cursors}
        emptyMessage="No hay historias con laboratorios solicitados pendientes de registro que coincidan con la busqueda."
        filterId="laboratorios-search"
        page={page}
        query={query}
        stationKey="laboratorios"
        statusIcon={<FlaskConicalIcon />}
      />
    </div>
  );
}
