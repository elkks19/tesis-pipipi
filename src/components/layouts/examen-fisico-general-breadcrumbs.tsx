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
  "/estudiante/examen-fisico-general": "Crear examen",
  "/estudiante/examen-fisico-general/actividad": "Actividad",
};

function getCurrentLabel(pathname: string) {
  if (pageLabels[pathname]) {
    return pageLabels[pathname];
  }

  if (pathname.startsWith("/estudiante/examen-fisico-general/")) {
    return "Formulario";
  }

  return "Examen fisico general";
}

export function ExamenFisicoGeneralBreadcrumbs() {
  const pathname = usePathname();
  const currentLabel = getCurrentLabel(pathname);
  const isHome = pathname === "/estudiante/examen-fisico-general";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage>Estacion de examen fisico</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/estudiante/examen-fisico-general">
                Estacion de examen fisico
              </Link>
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
