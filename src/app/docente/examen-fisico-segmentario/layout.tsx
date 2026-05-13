import type { ReactNode } from "react";
import { ScanSearchIcon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteExamenFisicoSegmentarioLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      basePath="/docente/examen-fisico-segmentario"
      description="Revision docente por regiones, aparatos y sistemas"
      icon={ScanSearchIcon}
      primaryLabel="Crear examen"
      subtitle="Docente encargado"
      title="Examen fisico segmentario"
    >
      {children}
    </DocenteStationLayout>
  );
}
