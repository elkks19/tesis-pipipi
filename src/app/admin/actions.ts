"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import Database from "better-sqlite3";

import { hasAuthPermission } from "@/lib/auth-permissions";
import {
  authRoleNames,
  type AuthRole,
} from "@/lib/auth-role-values";

function isAuthRole(value: string): value is AuthRole {
  return authRoleNames.includes(value as AuthRole);
}

export async function updateUserRole(userId: string, role: AuthRole) {
  const requestHeaders = await headers();
  const canSetRole = await hasAuthPermission({
    headers: requestHeaders,
    permission: {
      user: ["set-role"],
    },
  });

  if (!canSetRole) {
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
