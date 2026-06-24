import type { Metadata } from "next";

import { LogoutButton } from "@/components/auth/logout-button";
import { DataScienceChat } from "@/components/data-science/data-science-chat";

export const metadata: Metadata = {
  title: "Investigacion",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ResearcherResearchPage() {
  return (
    <main className="h-svh overflow-hidden bg-muted/40 p-2 sm:p-3">
      <div className="flex h-full min-h-0 flex-col gap-2">
        <section className="flex shrink-0 items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="text-lg font-semibold">Investigacion</h1>
            <p className="truncate text-xs text-muted-foreground">
              Consulta historias y prepara resultados docentes.
            </p>
          </div>
          <LogoutButton className="shrink-0" />
        </section>

        <DataScienceChat />
      </div>
    </main>
  );
}
