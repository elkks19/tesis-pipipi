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
  "/estudiante/farmacia/planeacion": "Inventario del viaje",
  "/estudiante/farmacia/inventario": "Inventario del viaje",
  "/estudiante/farmacia/entradas": "Entradas",
  "/estudiante/farmacia/recetas": "Entrega de recetas",
  "/estudiante/farmacia/insumos": "Entrega de insumos",
  "/estudiante/farmacia/movimientos": "Movimientos",
  "/estudiante/farmacia/actividad": "Actividad",
};

function getCurrentLabel(pathname: string) {
  return pageLabels[pathname] ?? "Farmacia";
}

export function FarmaciaBreadcrumbs() {
  const pathname = usePathname();
  const currentLabel = getCurrentLabel(pathname);
  const isHome = pathname === "/estudiante/farmacia";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage>Estacion de Farmacia</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/estudiante/farmacia">Estacion de Farmacia</Link>
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
