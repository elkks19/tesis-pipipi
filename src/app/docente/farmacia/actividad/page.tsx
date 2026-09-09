import { redirect } from "next/navigation";

import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";
import { DocenteStationActivityRoute } from "../../_components/station-activity-route";

export default async function DocenteFarmaciaActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const userId = await getAuthenticatedUserId();
  const trip = await getFarmaciaPlanningTrip({ mode: "docente", userId });

  if (!trip?.active) {
    redirect("/docente/farmacia/planeacion");
  }

  return (
    <DocenteStationActivityRoute
      basePath="/docente/farmacia/actividad"
      searchParams={searchParams}
      stationKey="farmacia"
      title="Actividad de farmacia"
    />
  );
}
