import type { ReactNode } from "react";
import { FilePlus2Icon, StethoscopeIcon } from "lucide-react";

import { DocenteStationLayout } from "@/components/layouts/docente-station-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DocenteAnamnesisLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DocenteStationLayout
      activityHref="/docente/anamnesis"
      basePath="/docente/anamnesis"
      description="Acompanamiento docente de historias clinicas"
      icon={StethoscopeIcon}
      primaryHref="/docente/anamnesis/create-historia"
      primaryIcon={FilePlus2Icon}
      primaryLabel="Nueva historia"
      subtitle="Docente encargado"
      title="Anamnesis"
    >
      {children}
    </DocenteStationLayout>
  );
}
