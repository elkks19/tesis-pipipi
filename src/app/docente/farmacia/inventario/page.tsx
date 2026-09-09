import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FarmaciaInventarioPage } from "@/components/farmacia/farmacia-inventario-page";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";

export const metadata: Metadata = {
  title: "Docente | Farmacia | Inventario",
};

export default async function DocenteFarmaciaInventarioPage() {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "docente", userId });

  if (!trip?.active) {
    redirect("/docente/farmacia/planeacion");
  }

  return <FarmaciaInventarioPage mode="docente" />;
}
