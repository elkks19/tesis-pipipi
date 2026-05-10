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
  "/estudiante/anamnesis": "Actividad",
  "/estudiante/anamnesis/create-historia": "Nueva historia",
  "/estudiante/anamnesis/create-paciente": "Crear paciente",
};

export function AnamnesisBreadcrumbs() {
  const pathname = usePathname();
  const currentLabel = pageLabels[pathname] ?? "Anamnesis";
  const isHome = pathname === "/estudiante/anamnesis";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <BreadcrumbPage>Estacion de anamnesis</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/estudiante/anamnesis">Estacion de anamnesis</Link>
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
