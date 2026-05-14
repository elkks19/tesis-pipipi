import type { Metadata } from "next";

import { AdminUsersTable } from "@/app/admin/admin-users-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAuthUsersWithAccounts } from "@/lib/auth-users";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  const users = listAuthUsersWithAccounts();

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Panel administrador
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios y roles</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminUsersTable users={users} />
        </CardContent>
      </Card>
    </main>
  );
}
