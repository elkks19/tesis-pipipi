import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FarmaciaPlaneacionPage } from "@/components/farmacia/farmacia-planeacion-page";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";

export const metadata: Metadata = {
  title: "Farmacia | Planeacion",
};

export default async function EstudianteFarmaciaPlaneacionPage() {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "estudiante", userId });

  if (trip?.active) {
    redirect("/estudiante/farmacia/inventario");
  }

  return <FarmaciaPlaneacionPage mode="estudiante" />;
}
