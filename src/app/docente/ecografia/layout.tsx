import type { ReactNode } from "react";
import { ScanLineIcon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteEcografiaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      basePath="/docente/ecografia"
      description="Revision docente de hallazgos ecograficos"
      icon={ScanLineIcon}
      primaryLabel="Crear ecografia"
      subtitle="Docente encargado"
      title="Ecografia"
    >
      {children}
    </DocenteStationLayout>
  );
}
