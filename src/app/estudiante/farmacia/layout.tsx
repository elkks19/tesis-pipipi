import type { ReactNode } from "react";

import { FarmaciaBreadcrumbs } from "@/components/layouts/farmacia-breadcrumbs";
import { FarmaciaSidebar } from "@/components/layouts/farmacia-sidebar";
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

export default async function FarmaciaLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "estudiante", userId });
  const accessPhase = trip?.accessPhase ?? "sin_acceso";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <FarmaciaSidebar accessPhase={accessPhase} />
        <SidebarInset className="min-w-0 bg-muted/40">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <FarmaciaBreadcrumbs />
              <span className="truncate text-xs text-muted-foreground">
                Inventario del viaje
              </span>
            </div>
          </header>
          <div className="mx-auto my-2 w-[calc(100%-1rem)] min-w-0 max-w-7xl rounded-3xl bg-background p-4 shadow-sm ring-1 ring-border/60 sm:my-4 sm:w-[calc(100%-2rem)] sm:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
