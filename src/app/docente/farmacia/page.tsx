import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";

export const metadata: Metadata = {
  title: "Docente | Farmacia",
};

export default async function DocenteFarmaciaPage() {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "docente", userId });

  redirect(trip?.accessPhase === "planeacion" ? "/docente/farmacia/planeacion" : "/docente/farmacia/inventario");
}
