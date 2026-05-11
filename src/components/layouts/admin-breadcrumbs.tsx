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
  "/admin/viajes": "Viajes",
  "/admin/viajes/create": "Crear viaje",
};

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const currentLabel = pathname.endsWith("/edit")
    ? "Editar viaje"
    : pageLabels[pathname] ?? "Administracion";
  const isHome = pathname === "/admin";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage>Administracion</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/admin/viajes">Administracion</Link>
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
