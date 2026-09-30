import type { AuthRole } from "@/lib/auth-role-values";

export type RegistrationAuthor = {
  name: string;
  email?: string;
  role?: AuthRole | null;
};

export function registrationRoleLabel(role?: AuthRole | null) {
  return role === "estudiante" ? "Estudiante"
    : role?.startsWith("docente") ? "Docente"
    : role === "admin" ? "Administrador" : "Responsable";
}

export function registrationAuthorLabel(author: RegistrationAuthor) {
  return `${registrationRoleLabel(author.role)}: ${author.name}`;
}
