import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import Database from "better-sqlite3";

import { adminRoles, authRoles, defaultAuthRole } from "@/lib/auth-roles";

const databasePath = process.env.BETTER_AUTH_SQLITE_PATH ?? "auth.sqlite";

export const auth = betterAuth({
  database: new Database(databasePath),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    admin({
      adminRoles,
      defaultRole: defaultAuthRole,
      roles: authRoles,
    }),
    nextCookies(),
  ],
});
