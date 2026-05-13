import type { ReactNode } from "react";
import { FlaskConicalIcon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteLaboratoriosLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      basePath="/docente/laboratorios"
      description="Revision docente de resultados de laboratorio"
      icon={FlaskConicalIcon}
      primaryLabel="Crear laboratorio"
      subtitle="Docente encargado"
      title="Laboratorios"
    >
      {children}
    </DocenteStationLayout>
  );
}
