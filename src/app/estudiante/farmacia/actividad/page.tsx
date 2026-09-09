import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";
import { EstudianteStationActivityRoute } from "../../_components/station-activity-route";

export const metadata: Metadata = {
  title: "Farmacia | Actividad",
};

export default async function FarmaciaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "estudiante", userId });

  if (!trip?.active) {
    redirect("/estudiante/farmacia/planeacion");
  }

  return (
    <EstudianteStationActivityRoute
      basePath="/estudiante/farmacia/actividad"
      searchParams={searchParams}
      stationKey="farmacia"
      title="Actividad de farmacia"
    />
  );
}
