"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateUserRole } from "@/app/admin/actions";
import {
  authRoleNames,
  defaultAuthRole,
  type AuthRole,
} from "@/lib/auth-role-values";
import type { AuthUserWithAccounts } from "@/lib/auth-users";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const roleLabels: Record<AuthRole, string> = {
  admin: "Admin",
  docente: "Docente",
  "docente-organizador": "Docente organizador",
  estudiante: "Estudiante",
};

const providerLabels: Record<string, string> = {
  credential: "Usuario y contraseña",
  google: "Google",
};

const rolePermissionSummary: Record<AuthRole, string> = {
  admin: "Gestion completa",
  docente: "Revision de estacion",
  "docente-organizador": "Puede crear viajes",
  estudiante: "Registro de estacion",
};

export function AdminUsersTable({ users }: { users: AuthUserWithAccounts[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(userId: string, role: AuthRole) {
    startTransition(async () => {
      const result = await updateUserRole(userId, role);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead className="hidden md:table-cell">Accesos</TableHead>
            <TableHead className="hidden lg:table-cell">Permiso clave</TableHead>
            <TableHead className="w-56">Rol</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const role = user.role ?? defaultAuthRole;

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {user.email}
                    </span>
                    <span className="text-xs text-muted-foreground md:hidden">
                      {formatProviders(user.providers)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {formatProviders(user.providers)}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  {rolePermissionSummary[role]}
                </TableCell>
                <TableCell>
                  <Select
                    disabled={isPending}
                    onValueChange={(nextRole) =>
                      handleRoleChange(user.id, nextRole as AuthRole)
                    }
                    value={role}
                  >
                    <SelectTrigger aria-label={`Rol de ${user.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {authRoleNames.map((roleName) => (
                          <SelectItem key={roleName} value={roleName}>
                            {roleLabels[roleName]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function formatProviders(providers: string[]) {
  if (providers.length === 0) {
    return "Sin accesos vinculados";
  }

  return providers
    .map((provider) => providerLabels[provider] ?? provider)
    .join(", ");
}
