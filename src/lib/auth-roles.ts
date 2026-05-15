import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/admin/access";

import type { AuthRole } from "@/lib/auth-role-values";
export {
  adminRoles,
  authRoleNames,
  defaultAuthRole,
  docenteRoles,
  estudianteRoles,
} from "@/lib/auth-role-values";

export const authStatements = {
  ...defaultStatements,
  actividad: ["read"] as const,
  estacion: ["read", "write", "review"] as const,
  viaje: ["create", "read", "list", "update", "delete"] as const,
} as const;

export const authAccessControl = createAccessControl(authStatements);

const estudiante = authAccessControl.newRole({
  actividad: ["read"],
  estacion: ["read", "write"],
  session: [],
  user: [],
  viaje: ["read"],
});

const docente = authAccessControl.newRole({
  actividad: ["read"],
  estacion: ["read", "review", "write"],
  session: [],
  user: [],
  viaje: ["read"],
});

const docenteOrganizador = authAccessControl.newRole({
  actividad: ["read"],
  estacion: ["read", "review", "write"],
  session: [],
  user: [],
  viaje: ["create", "read", "list"],
});

const admin = authAccessControl.newRole({
  ...adminAc.statements,
  actividad: ["read"],
  estacion: ["read", "review", "write"],
  viaje: ["create", "read", "list", "update", "delete"],
});

export const authRoles = {
  admin,
  docente,
  "docente-organizador": docenteOrganizador,
  estudiante,
} satisfies Record<AuthRole, typeof estudiante>;
