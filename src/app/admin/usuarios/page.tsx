import type { Metadata } from "next";

import { AdminUsersTable } from "@/app/admin/admin-users-table";
import { listAuthUsersWithAccounts } from "@/lib/auth-users";

export const metadata: Metadata = {
  title: "Usuarios",
};

export default function AdminUsersPage() {
  const users = listAuthUsersWithAccounts();

  return (
    <main className="flex h-[calc(100svh-7.5rem)] min-h-0 flex-col gap-3 sm:h-[calc(100svh-9rem)] lg:h-[calc(100svh-10rem)]">
      <section className="flex shrink-0 flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">
          Administracion
        </p>
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <p className="max-w-3xl text-xs text-muted-foreground sm:text-sm">
          Gestiona accesos, roles e invitaciones para docentes, estudiantes e
          investigadores.
        </p>
      </section>

      <AdminUsersTable users={users} />
    </main>
  );
}
