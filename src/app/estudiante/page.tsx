import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { resolveStudentTripRoute } from "./student-trip-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EstudiantePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const resolution = await resolveStudentTripRoute(session?.user);

  redirect(resolution.redirectTo ?? "/estudiante/anamnesis");
}
