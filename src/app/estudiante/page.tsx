import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { NoActiveTripDashboard } from "@/components/trips/no-active-trip-dashboard";
import { auth } from "@/lib/auth";

import { resolveStudentTripRoute } from "./student-trip-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EstudiantePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const resolution = await resolveStudentTripRoute(session?.user).catch(
    () => ({}) as Awaited<ReturnType<typeof resolveStudentTripRoute>>,
  );

  if (resolution.redirectTo) {
    redirect(resolution.redirectTo);
  }

  return (
    <NoActiveTripDashboard
      mode="estudiante"
      refreshHref="/estudiante"
      trips={resolution.futureTrips}
      user={session?.user}
    />
  );
}
