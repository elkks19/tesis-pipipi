import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { DocenteStationBreadcrumbs } from "@/components/layouts/docente-station-breadcrumbs";
import { DocenteStationSidebar } from "@/components/layouts/docente-station-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

type DocenteStationLayoutProps = {
  activityHref?: string;
  basePath: string;
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  performanceHref?: string;
  primaryHref?: string;
  primaryIcon?: LucideIcon;
  primaryLabel: string;
  showActivity?: boolean;
  showPerformance?: boolean;
  subtitle: string;
  title: string;
};

export function DocenteStationLayout({
  activityHref,
  basePath,
  children,
  description,
  icon,
  performanceHref,
  primaryHref,
  primaryIcon,
  primaryLabel,
  showActivity,
  showPerformance,
  subtitle,
  title,
}: DocenteStationLayoutProps) {
  void icon;
  void primaryIcon;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <DocenteStationSidebar
          activityHref={activityHref}
          basePath={basePath}
          performanceHref={performanceHref}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          showActivity={showActivity}
          showPerformance={showPerformance}
          subtitle={subtitle}
          title={title}
        />
        <SidebarInset className="bg-muted/40">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DocenteStationBreadcrumbs
                activityHref={activityHref}
                basePath={basePath}
                performanceHref={performanceHref}
                primaryHref={primaryHref}
                primaryLabel={primaryLabel}
                showActivity={showActivity}
                showPerformance={showPerformance}
                title={title}
              />
              <span className="truncate text-xs text-muted-foreground">
                {description}
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
