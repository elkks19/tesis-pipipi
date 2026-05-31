export const authRoleNames = [
  "docente",
  "docente-organizador",
  "docente-investigador",
  "admin",
  "estudiante",
] as const;

export type AuthRole = (typeof authRoleNames)[number];

export const adminRoles = ["admin"] satisfies AuthRole[];
export const defaultAuthRole = "estudiante" satisfies AuthRole;
export const docenteRoles = ["docente", "docente-organizador"] satisfies AuthRole[];
export const researcherRoles = ["docente-investigador"] satisfies AuthRole[];
export const estudianteRoles = ["estudiante"] satisfies AuthRole[];
