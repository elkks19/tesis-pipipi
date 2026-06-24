import type { Metadata } from "next";

import { FarmaciaPlaneacionPage } from "@/components/farmacia/farmacia-planeacion-page";

export const metadata: Metadata = {
  title: "Docente | Farmacia | Planeacion",
};

export default function DocenteFarmaciaPlaneacionPage() {
  return <FarmaciaPlaneacionPage mode="docente" />;
}
