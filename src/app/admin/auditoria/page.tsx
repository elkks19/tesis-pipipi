import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { getAuthenticatedUser } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administración | Auditoría" };

export default async function AuditPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <AuditLogPanel />;
}
