import type { Metadata } from "next";

import { listAuthUsersWithAccounts } from "@/lib/auth-users";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminPage() {
  const users = listAuthUsersWithAccounts();
  const usersByRole = users.reduce<Record<string, number>>((totals, user) => {
    const role = user.role ?? "estudiante";
    totals[role] = (totals[role] ?? 0) + 1;
    return totals;
  }, {});

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Panel administrador
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Vista general de usuarios y accesos del sistema.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Usuarios</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {users.length}
          </p>
        </div>
        <div className="rounded-3xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Docentes</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {(usersByRole.docente ?? 0) +
              (usersByRole["docente-organizador"] ?? 0)}
          </p>
        </div>
        <div className="rounded-3xl border bg-background p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Investigadores</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {usersByRole["docente-investigador"] ?? 0}
          </p>
        </div>
      </section>
    </main>
  );
}
