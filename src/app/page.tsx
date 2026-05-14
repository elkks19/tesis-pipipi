import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getRoleHomePath, getSessionUserRole } from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  redirect(getRoleHomePath(getSessionUserRole(session.user)));
}
