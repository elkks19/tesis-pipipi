import type { ReactNode } from "react";
import { FileCheck2Icon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteDiagnosticoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      basePath="/docente/diagnostico"
      description="Revision docente del cierre diagnostico"
      icon={FileCheck2Icon}
      primaryLabel="Crear diagnostico"
      subtitle="Docente encargado"
      title="Diagnostico"
    >
      {children}
    </DocenteStationLayout>
  );
}
