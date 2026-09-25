import type { ReactNode } from "react";

import { FarmaciaDocenteSidebar } from "@/components/layouts/farmacia-docente-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DocenteFarmaciaLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "docente", userId });
  const accessPhase = trip?.accessPhase ?? "sin_acceso";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <FarmaciaDocenteSidebar accessPhase={accessPhase} />
        <SidebarInset className="min-w-0 overflow-x-hidden bg-muted/40">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">Farmacia</span>
              <span className="truncate text-xs text-muted-foreground">
                {accessPhase === "activo"
                  ? "Inventario, recetas y dispensacion del viaje"
                  : "Planeacion del inventario"}
              </span>
            </div>
          </header>
          <div className="m-2 mx-auto min-w-0 w-[calc(100%-1rem)] max-w-7xl overflow-x-hidden rounded-3xl bg-background p-4 shadow-sm ring-1 ring-border/60 sm:m-4 sm:w-[calc(100%-2rem)] sm:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
