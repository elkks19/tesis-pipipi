import fs from "node:fs";
import path from "node:path";

import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import { admin } from "better-auth/plugins/admin";
import { defaultAc } from "better-auth/plugins/admin/access";

const emptyRole = defaultAc.newRole({
  session: [],
  user: [],
});

const authRoles = {
  admin: emptyRole,
  docente: emptyRole,
  "docente-organizador": emptyRole,
  estudiante: emptyRole,
};

const seedUsers = [
  {
    email: "admin.coordinacion@tesis.local",
    name: "Coordinacion Medica",
    password: "Password123!",
    role: "admin",
  },
  {
    email: "docente.anamnesis@tesis.local",
    name: "Dra. Ana Mendez",
    password: "Password123!",
    role: "docente",
  },
  {
    email: "docente.medicina@tesis.local",
    name: "Dr. Marco Rojas",
    password: "Password123!",
    role: "docente-organizador",
  },
  {
    email: "docente.clinica@tesis.local",
    name: "Dra. Carla Vargas",
    password: "Password123!",
    role: "docente",
  },
  {
    email: "estudiante.sofia@tesis.local",
    name: "Sofia Gutierrez",
    password: "Password123!",
    role: "estudiante",
  },
  {
    email: "estudiante.luis@tesis.local",
    name: "Luis Fernandez",
    password: "Password123!",
    role: "estudiante",
  },
  {
    email: "estudiante.valeria@tesis.local",
    name: "Valeria Quiroga",
    password: "Password123!",
    role: "estudiante",
  },
  {
    email: "estudiante.diego@tesis.local",
    name: "Diego Camacho",
    password: "Password123!",
    role: "estudiante",
  },
  {
    email: "estudiante.maria@tesis.local",
    name: "Maria Salazar",
    password: "Password123!",
    role: "estudiante",
  },
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env"));

const databasePath = process.env.BETTER_AUTH_SQLITE_PATH ?? "auth.sqlite";
const database = new Database(databasePath);

const auth = betterAuth({
  database,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      adminRoles: ["admin"],
      defaultRole: "estudiante",
      roles: authRoles,
    }),
  ],
});

let created = 0;
let skipped = 0;

for (const user of seedUsers) {
  const { role, ...credentials } = user;

  try {
    await auth.api.signUpEmail({
      body: credentials,
      headers: new Headers({
        host: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000")
          .host,
      }),
    });

    created += 1;
    console.log(`created ${user.email}`);
  } catch (error) {
    skipped += 1;
    console.log(`skipped ${user.email}`);

    if (
      error instanceof Error &&
      !/already|exists|duplicate|unique/i.test(error.message)
    ) {
      console.log(`  ${error.message}`);
    }
  }

  if (role) {
    database
      .prepare('UPDATE "user" SET role = ?, updatedAt = ? WHERE email = ?')
      .run(role, new Date().toISOString(), user.email);
  }
}

console.log(`seed complete: ${created} created, ${skipped} skipped`);
