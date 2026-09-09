import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";

export const metadata: Metadata = {
  title: "Farmacia",
};

export default async function FarmaciaPage() {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "estudiante", userId });

  if (trip?.active) {
    redirect("/estudiante/farmacia/inventario");
  }

  redirect("/estudiante/farmacia/planeacion");
}
