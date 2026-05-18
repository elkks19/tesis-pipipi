import type { Metadata } from "next";
import { WindIcon } from "lucide-react";

import { PendingHistoriesTable } from "../_components/pending-histories-table";
import { listPendingComplementaryExamHistories } from "../_lib/station-history-queries";

export const metadata: Metadata = {
  title: "Espirometria",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EspirometriaPageProps = {
  searchParams: Promise<{
    cursor?: string | string[];
    cursors?: string | string[];
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function EspirometriaPage({
  searchParams,
}: EspirometriaPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const cursor = getParam(params.cursor);
  const cursors = getParam(params.cursors)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const page = await listPendingComplementaryExamHistories({
    cursor,
    examKey: "espirometria",
    query,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Espirometria</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecciona una historia con espirometria solicitada y registra los
          valores de funcion pulmonar.
        </p>
      </div>

      <PendingHistoriesTable
        basePath="/estudiante/espirometria"
        cursor={cursor}
        cursors={cursors}
        emptyMessage="No hay historias con espirometria solicitada pendientes de registro que coincidan con la busqueda."
        filterId="espirometria-search"
        page={page}
        query={query}
        stationKey="espirometria"
        statusIcon={<WindIcon />}
      />
    </div>
  );
}
