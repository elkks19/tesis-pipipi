import type { ReactNode } from "react";
import { ActivityIcon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteElectrocardiogramaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      basePath="/docente/electrocardiograma"
      description="Revision docente del registro electrocardiografico"
      icon={ActivityIcon}
      primaryLabel="Crear electrocardiograma"
      subtitle="Docente encargado"
      title="Electrocardiograma"
    >
      {children}
    </DocenteStationLayout>
  );
}
