import type { Metadata } from "next";

import { FarmaciaPlaneacionPage } from "@/components/farmacia/farmacia-planeacion-page";

export const metadata: Metadata = {
  title: "Farmacia | Planeacion",
};

export default function EstudianteFarmaciaPlaneacionPage() {
  return <FarmaciaPlaneacionPage mode="estudiante" />;
}
