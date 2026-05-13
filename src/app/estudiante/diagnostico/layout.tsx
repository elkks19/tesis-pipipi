import type { ReactNode } from "react";

import { DiagnosticoBreadcrumbs } from "@/components/layouts/diagnostico-breadcrumbs";
import { DiagnosticoSidebar } from "@/components/layouts/diagnostico-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DiagnosticoLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <DiagnosticoSidebar />
        <SidebarInset className="bg-muted/40">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DiagnosticoBreadcrumbs />
              <span className="truncate text-xs text-muted-foreground">
                Diagnostico CIE-11 y plan de trabajo
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
