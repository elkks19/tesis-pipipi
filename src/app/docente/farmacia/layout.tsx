import type { ReactNode } from "react";
import { PackagePlusIcon, PillIcon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteFarmaciaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      basePath="/docente/farmacia"
      description="Planeacion e inventario del viaje"
      icon={PillIcon}
      primaryHref="/docente/farmacia/planeacion"
      primaryIcon={PackagePlusIcon}
      primaryLabel="Planeacion"
      showActivity={false}
      showPerformance={false}
      subtitle="Docente encargado"
      title="Farmacia"
    >
      {children}
    </DocenteStationLayout>
  );
}
