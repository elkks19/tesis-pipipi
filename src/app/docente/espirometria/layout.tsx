import type { ReactNode } from "react";
import { WindIcon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteEspirometriaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      basePath="/docente/espirometria"
      description="Revision docente de resultados respiratorios"
      icon={WindIcon}
      primaryLabel="Crear espirometria"
      subtitle="Docente encargado"
      title="Espirometria"
    >
      {children}
    </DocenteStationLayout>
  );
}
