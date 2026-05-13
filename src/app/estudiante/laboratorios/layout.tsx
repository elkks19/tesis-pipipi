import type { ReactNode } from "react";

import { LaboratoriosBreadcrumbs } from "@/components/layouts/laboratorios-breadcrumbs";
import { LaboratoriosSidebar } from "@/components/layouts/laboratorios-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function LaboratoriosLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <LaboratoriosSidebar />
        <SidebarInset className="bg-muted/40">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <LaboratoriosBreadcrumbs />
              <span className="truncate text-xs text-muted-foreground">
                Resultados de laboratorio
              </span>
            </div>
          </header>
          <div className="m-2 mx-auto w-[calc(100%-1rem)] max-w-7xl rounded-3xl bg-background p-4 shadow-sm ring-1 ring-border/60 sm:m-4 sm:w-[calc(100%-2rem)] sm:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
