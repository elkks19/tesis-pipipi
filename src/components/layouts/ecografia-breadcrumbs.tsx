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

const pageLabels: Record<string, string> = {
  "/estudiante/ecografia": "Crear ecografia",
  "/estudiante/ecografia/actividad": "Actividad",
};

function getCurrentLabel(pathname: string) {
  if (pageLabels[pathname]) {
    return pageLabels[pathname];
  }

  if (pathname.startsWith("/estudiante/ecografia/")) {
    return "Formulario";
  }

  return "Ecografia";
}

export function EcografiaBreadcrumbs() {
  const pathname = usePathname();
  const currentLabel = getCurrentLabel(pathname);
  const isHome = pathname === "/estudiante/ecografia";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage>Estacion de ecografia</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/estudiante/ecografia">Estacion de ecografia</Link>
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
