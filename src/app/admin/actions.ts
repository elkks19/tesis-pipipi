"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import Database from "better-sqlite3";

import { auth } from "@/lib/auth";
import {
  adminRoles,
  authRoleNames,
  defaultAuthRole,
  type AuthRole,
} from "@/lib/auth-role-values";

function isAuthRole(value: string): value is AuthRole {
  return authRoleNames.includes(value as AuthRole);
}

export async function updateUserRole(userId: string, role: AuthRole) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const currentRole = session?.user.role ?? defaultAuthRole;

  if (
    !session ||
    !(adminRoles as readonly AuthRole[]).includes(currentRole as AuthRole)
  ) {
    return {
      message: "No tienes permisos para cambiar roles.",
      ok: false,
    };
  }

  if (!userId || !isAuthRole(role)) {
    return {
      message: "Rol invalido.",
      ok: false,
    };
  }

  const database = new Database(
    process.env.BETTER_AUTH_SQLITE_PATH ?? "auth.sqlite",
  );

  try {
    const result = database
      .prepare('UPDATE "user" SET role = ?, updatedAt = ? WHERE id = ?')
      .run(role, new Date().toISOString(), userId);

    if (result.changes === 0) {
      return {
        message: "Usuario no encontrado.",
        ok: false,
      };
    }

    revalidatePath("/admin");

    return {
      message: "Rol actualizado.",
      ok: true,
    };
  } finally {
    database.close();
  }
}
