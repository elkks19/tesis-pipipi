import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FarmaciaPlaneacionPage } from "@/components/farmacia/farmacia-planeacion-page";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";

export const metadata: Metadata = {
  title: "Docente | Farmacia | Planeacion",
};

export default async function DocenteFarmaciaPlaneacionPage() {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "docente", userId });

  if (trip?.active) {
    redirect("/docente/farmacia/inventario");
  }

  return <FarmaciaPlaneacionPage mode="docente" />;
}
