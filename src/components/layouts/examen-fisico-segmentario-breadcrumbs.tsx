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
  "/estudiante/examen-fisico-segmentario": "Crear examen",
  "/estudiante/examen-fisico-segmentario/actividad": "Actividad",
};

function getCurrentLabel(pathname: string) {
  if (pageLabels[pathname]) {
    return pageLabels[pathname];
  }

  if (pathname.startsWith("/estudiante/examen-fisico-segmentario/")) {
    return "Formulario";
  }

  return "Examen fisico segmentario";
}

export function ExamenFisicoSegmentarioBreadcrumbs() {
  const pathname = usePathname();
  const currentLabel = getCurrentLabel(pathname);
  const isHome = pathname === "/estudiante/examen-fisico-segmentario";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage>Estacion de examen segmentario</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/estudiante/examen-fisico-segmentario">
                Estacion de examen segmentario
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
