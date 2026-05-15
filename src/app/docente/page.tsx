import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { NoActiveTripDashboard } from "@/components/trips/no-active-trip-dashboard";
import { auth } from "@/lib/auth";
import { getSessionUserRole } from "@/lib/role-redirect";
import { resolveDocenteTripRoute } from "@/lib/student-trip-resolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DocentePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const resolution = await resolveDocenteTripRoute(session?.user.id).catch(
    () => ({}) as Awaited<ReturnType<typeof resolveDocenteTripRoute>>,
  );

  if (resolution.redirectTo) {
    redirect(resolution.redirectTo);
  }

  return (
    <NoActiveTripDashboard
      mode="docente"
      canCreateViaje={getSessionUserRole(session?.user) === "docente-organizador"}
      refreshHref="/docente"
      trips={resolution.futureTrips}
      user={session?.user}
    />
  );
}
