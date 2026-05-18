"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type DocenteStationBreadcrumbsProps = {
  activityHref?: string;
  basePath: string;
  performanceHref?: string;
  primaryHref?: string;
  primaryLabel: string;
  title: string;
};

function getCurrentLabel(
  pathname: string,
  activityHref: string,
  basePath: string,
  performanceHref: string,
  primaryHref: string,
  primaryLabel: string,
) {
  if (pathname === primaryHref || pathname.startsWith(`${primaryHref}/`)) {
    return primaryLabel;
  }

  if (pathname === activityHref) {
    return "Actividad";
  }

  if (pathname === performanceHref) {
    return "Rendimiento";
  }

  if (pathname === `${basePath}/create-paciente`) {
    return "Crear paciente";
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return "Formulario";
  }

  return primaryLabel;
}

export function DocenteStationBreadcrumbs({
  activityHref,
  basePath,
  performanceHref,
  primaryHref,
  primaryLabel,
  title,
}: DocenteStationBreadcrumbsProps) {
  const pathname = usePathname();
  const resolvedActivityHref = activityHref ?? `${basePath}/actividad`;
  const resolvedPerformanceHref = performanceHref ?? `${basePath}/rendimiento`;
  const resolvedPrimaryHref = primaryHref ?? basePath;
  const currentLabel = getCurrentLabel(
    pathname,
    resolvedActivityHref,
    basePath,
    resolvedPerformanceHref,
    resolvedPrimaryHref,
    primaryLabel,
  );
  const isHome = pathname === basePath;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage>{title}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href={basePath}>{title}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {!isHome ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
