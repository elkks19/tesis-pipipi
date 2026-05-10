import { defaultAc } from "better-auth/plugins/admin/access";

import type { AuthRole } from "@/lib/auth-role-values";
export {
  adminRoles,
  authRoleNames,
  defaultAuthRole,
  docenteRoles,
  estudianteRoles,
} from "@/lib/auth-role-values";

const emptyRole = defaultAc.newRole({
  session: [],
  user: [],
});

export const authRoles = {
  admin: emptyRole,
  docente: emptyRole,
  "docente-organizador": emptyRole,
  estudiante: emptyRole,
} satisfies Record<AuthRole, typeof emptyRole>;
