import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { SyncPanel } from "@/components/admin/sync-panel";
export const dynamic = "force-dynamic";
export const metadata = { title: "Administración | Sincronización" };
export default async function SyncPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <SyncPanel />;
}
