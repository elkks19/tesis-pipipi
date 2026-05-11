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
  "/estudiante/electrocardiograma": "Crear electrocardiograma",
  "/estudiante/electrocardiograma/actividad": "Actividad",
};

function getCurrentLabel(pathname: string) {
  if (pageLabels[pathname]) {
    return pageLabels[pathname];
  }

  if (pathname.startsWith("/estudiante/electrocardiograma/")) {
    return "Formulario";
  }

  return "Electrocardiograma";
}

export function ElectrocardiogramaBreadcrumbs() {
  const pathname = usePathname();
  const currentLabel = getCurrentLabel(pathname);
  const isHome = pathname === "/estudiante/electrocardiograma";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage>Estacion de electrocardiograma</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/estudiante/electrocardiograma">
                Estacion de electrocardiograma
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
