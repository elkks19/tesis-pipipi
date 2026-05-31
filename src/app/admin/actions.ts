"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import Database from "better-sqlite3";

import { auth } from "@/lib/auth";
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
    revalidatePath("/admin/usuarios");

    return {
      message: "Rol actualizado.",
      ok: true,
    };
  } finally {
    database.close();
  }
}

export async function inviteUser(formData: FormData) {
  const requestHeaders = await headers();
  const canCreateUser = await hasAuthPermission({
    headers: requestHeaders,
    permission: {
      user: ["create"],
    },
  });

  if (!canCreateUser) {
    return {
      message: "No tienes permisos para invitar usuarios.",
      ok: false,
      temporaryPassword: null,
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? defaultInviteRole);

  if (!email || !isAuthRole(role)) {
    return {
      message: "Completa correo y rol valido.",
      ok: false,
      temporaryPassword: null,
    };
  }

  const temporaryPassword = generateTemporaryPassword();

  try {
    await auth.api.createUser({
      body: {
        email,
        name: getNameFromEmail(email),
        password: temporaryPassword,
        role,
      },
      headers: requestHeaders,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/usuarios");

    return {
      message: "Usuario invitado. Comparte la contraseña temporal.",
      ok: true,
      temporaryPassword,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo invitar al usuario.",
      ok: false,
      temporaryPassword: null,
    };
  }
}

const defaultInviteRole = "docente-investigador" satisfies AuthRole;

function generateTemporaryPassword() {
  return `Tesis-${randomBytes(9).toString("base64url")}`;
}

function getNameFromEmail(email: string) {
  const [localPart = "Usuario"] = email.split("@");

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ") || email;
}
