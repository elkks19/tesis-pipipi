import type { Metadata } from "next";

import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { getAdminDashboardSummary } from "@/lib/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin",
};

type AdminPageProps = {
  searchParams: Promise<{
    viajeId?: string | string[];
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const selectedTripId = Array.isArray(params.viajeId)
    ? params.viajeId[0]
    : params.viajeId;
  const summary = await getAdminDashboardSummary(selectedTripId);

  return <AdminDashboard summary={summary} />;
}
