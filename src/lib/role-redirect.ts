import {
  adminRoles,
  authRoleNames,
  defaultAuthRole,
  docenteRoles,
  estudianteRoles,
  type AuthRole,
} from "@/lib/auth-role-values";

type SessionUserLike = {
  role?: string | null;
};

export function getSessionUserRole(user?: SessionUserLike | null): AuthRole {
  const role = user?.role;

  if (role && authRoleNames.includes(role as AuthRole)) {
    return role as AuthRole;
  }

  return defaultAuthRole;
}

export function getRoleHomePath(role: AuthRole) {
  if (hasRole(adminRoles, role)) {
    return "/admin";
  }

  if (hasRole(docenteRoles, role)) {
    return "/docente";
  }

  return "/estudiante";
}

export function canAccessAdmin(role: AuthRole) {
  return hasRole(adminRoles, role);
}

export function canAccessDocente(role: AuthRole) {
  return hasRole(adminRoles, role) || hasRole(docenteRoles, role);
}

export function canAccessEstudiante(role: AuthRole) {
  return hasRole(adminRoles, role) || hasRole(estudianteRoles, role);
}

function hasRole(roles: readonly AuthRole[], role: AuthRole) {
  return roles.includes(role);
}
