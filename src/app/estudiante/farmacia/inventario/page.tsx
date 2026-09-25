import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FarmaciaInventarioPage } from "@/components/farmacia/farmacia-inventario-page";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";

export const metadata: Metadata = {
  title: "Farmacia | Inventario",
};

export default async function EstudianteFarmaciaInventarioPage() {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "estudiante", userId });

  if (!trip || trip.accessPhase === "planeacion") {
    redirect("/estudiante/farmacia/planeacion");
  }

  return <FarmaciaInventarioPage mode="estudiante" />;
}
