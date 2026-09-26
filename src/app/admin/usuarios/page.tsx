import type { Metadata } from "next";

import { AdminUsersTable } from "@/app/admin/admin-users-table";
import { listAuthUsersWithAccounts } from "@/lib/auth-users";

export const metadata: Metadata = {
  title: "Usuarios",
};

export default function AdminUsersPage() {
  if (process.env.APP_ENVIRONMENT === "raspberry") return <div className="flex flex-col gap-2"><h1 className="text-xl font-semibold">Cuentas sincronizadas</h1><p>Administra los usuarios, roles y contraseñas en la nube. Los cambios se reciben al recuperar la conexión.</p></div>;
  const users = listAuthUsersWithAccounts();

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-10">
      <section className="flex flex-col gap-1.5 border-b pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Administración · Coordinación
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Usuarios</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Gestiona accesos, roles e invitaciones para docentes, estudiantes e
          investigadores.
        </p>
      </section>

      <AdminUsersTable users={users} />
    </main>
  );
}
