import type { Metadata } from "next";

import { listViajes } from "@/app/admin/viajes/queries";
import { DataScienceChat } from "@/components/data-science/data-science-chat";
import { toDataScienceTripOptions } from "@/lib/data-science-trip-options";

export const metadata: Metadata = {
  title: "Investigacion",
};

export default async function AdminResearchPage() {
  const viajes = await listViajes({});
  const tripOptions = toDataScienceTripOptions(viajes);

  return (
    <main
      className="flex h-[calc(100svh-5.5rem)] min-h-0 flex-col gap-2 sm:h-[calc(100svh-6.5rem)]"
      data-admin-workspace
    >
      <section className="flex shrink-0 items-baseline gap-3 px-1">
        <h1 className="text-lg font-semibold">Investigacion</h1>
        <p className="truncate text-xs text-muted-foreground">
          Consulta historias y prepara resultados docentes.
        </p>
      </section>

      <DataScienceChat trips={tripOptions} />
    </main>
  );
}
