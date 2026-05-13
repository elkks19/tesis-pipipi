import type { ReactNode } from "react";
import { HeartPulseIcon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteExamenFisicoGeneralLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      basePath="/docente/examen-fisico-general"
      description="Revision docente de signos vitales y mediciones"
      icon={HeartPulseIcon}
      primaryLabel="Crear examen"
      subtitle="Docente encargado"
      title="Examen fisico general"
    >
      {children}
    </DocenteStationLayout>
  );
}
