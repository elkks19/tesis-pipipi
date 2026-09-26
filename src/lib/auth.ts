import { createAuthMiddleware, APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import Database from "better-sqlite3";

import {
	adminRoles,
	authAccessControl,
	authRoles,
	defaultAuthRole,
} from "@/lib/auth-roles";

const databasePath = process.env.BETTER_AUTH_SQLITE_PATH ?? "auth.sqlite";
const trustedOrigins = [
	process.env.BETTER_AUTH_URL,
	"http://localhost:5173",
	"http://localhost:3000",
	'http://pcerda:5173',
	...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
]
	.map((origin) => origin?.trim())
	.filter((origin): origin is string => Boolean(origin));

const raspberry = process.env.APP_ENVIRONMENT === "raspberry";
export const auth = betterAuth({
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const allowed = ["/sign-in/email", "/sign-out", "/get-session", "/list-sessions", "/revoke-session", "/revoke-sessions", "/revoke-other-sessions", "/list-accounts", "/account-info", "/ok", "/error"];
      if (raspberry && !allowed.includes(ctx.path)) throw new APIError("FORBIDDEN", { message: "Las cuentas se administran en la nube. En la Raspberry usa tu contraseña sincronizada." });
    }),
  },
	trustedOrigins,
	database: new Database(databasePath),
	emailAndPassword: {
		enabled: true,
	},
	socialProviders: raspberry ? {} : {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
	},
	plugins: [
		admin({
			ac: authAccessControl,
			adminRoles,
			defaultRole: defaultAuthRole,
			roles: authRoles,
		}),
		nextCookies(),
	],
});
