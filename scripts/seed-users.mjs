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

const password = "tesis123";
const stationSeeds = [
  {
    docenteEmail: "docente-anamnesis@tesis.com",
    docenteName: "Docente Anamnesis",
    label: "Anamnesis",
    slug: "anamnesis",
    students: [
      "Ana Anamnesis",
      "Luis Anamnesis",
      "Sofia Anamnesis",
      "Diego Anamnesis",
    ],
  },
  {
    docenteEmail: "docente-efg@tesis.com",
    docenteName: "Docente EFG",
    label: "Examen Fisico General",
    slug: "efg",
    students: ["Ana EFG", "Luis EFG", "Sofia EFG", "Diego EFG"],
  },
  {
    docenteEmail: "docente-efs@tesis.com",
    docenteName: "Docente EFS",
    label: "Examen Fisico Segmentario",
    slug: "efs",
    students: ["Ana EFS", "Luis EFS", "Sofia EFS", "Diego EFS"],
  },
  {
    docenteEmail: "docente-ecografia@tesis.com",
    docenteName: "Docente Ecografia",
    label: "Ecografia",
    slug: "ecografia",
    students: [
      "Ana Ecografia",
      "Luis Ecografia",
      "Sofia Ecografia",
      "Diego Ecografia",
    ],
  },
  {
    docenteEmail: "docente-electrocardiograma@tesis.com",
    docenteName: "Docente Electrocardiograma",
    label: "Electrocardiograma",
    slug: "electrocardiograma",
    students: [
      "Ana Electrocardiograma",
      "Luis Electrocardiograma",
      "Sofia Electrocardiograma",
      "Diego Electrocardiograma",
    ],
  },
  {
    docenteEmail: "docente-espirometria@tesis.com",
    docenteName: "Docente Espirometria",
    label: "Espirometria",
    slug: "espirometria",
    students: [
      "Ana Espirometria",
      "Luis Espirometria",
      "Sofia Espirometria",
      "Diego Espirometria",
    ],
  },
  {
    docenteEmail: "docente-laboratorios@tesis.com",
    docenteName: "Docente Laboratorios",
    label: "Laboratorios",
    slug: "laboratorios",
    students: [
      "Ana Laboratorios",
      "Luis Laboratorios",
      "Sofia Laboratorios",
      "Diego Laboratorios",
    ],
  },
  {
    docenteEmail: "docente-diagnostico@tesis.com",
    docenteName: "Docente Diagnostico",
    label: "Diagnostico",
    slug: "diagnostico",
    students: [
      "Ana Diagnostico",
      "Luis Diagnostico",
      "Sofia Diagnostico",
      "Diego Diagnostico",
    ],
  },
  {
    docenteEmail: "docente-farmacia@tesis.com",
    docenteName: "Docente Farmacia",
    label: "Farmacia",
    slug: "farmacia",
    students: [
      "Ana Farmacia",
      "Luis Farmacia",
      "Sofia Farmacia",
      "Diego Farmacia",
    ],
  },
];

const stationUsers = stationSeeds.flatMap((station) => [
  {
    email: station.docenteEmail,
    name: station.docenteName,
    password,
    role: "docente",
  },
  ...station.students.map((name, index) => ({
    email: `estudiante-${station.slug}-${index + 1}@tesis.com`,
    name,
    password,
    role: "estudiante",
  })),
]);

const seedUsers = [
  {
    email: "rafafabiani1909@gmail.com",
    name: "Rafael Fabiani",
    password: "rafa1909",
    role: "admin",
  },
  {
    email: "admin@tesis.com",
    name: "Coordinacion Medica",
    password,
    role: "admin",
  },
  {
    email: "docente-organizador@tesis.com",
    name: "Docente Organizador",
    password,
    role: "docente-organizador",
  },
  ...stationUsers,
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

function tableExists(tableName) {
  const row = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(tableName);

  return Boolean(row);
}

function deleteTableRows(tableName) {
  if (!tableExists(tableName)) {
    return;
  }

  database.prepare(`DELETE FROM "${tableName}"`).run();
}

database.transaction(() => {
  database.pragma("foreign_keys = OFF");
  deleteTableRows("session");
  deleteTableRows("account");
  deleteTableRows("verification");
  deleteTableRows("user");
  database.pragma("foreign_keys = ON");
})();

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
    console.log(`failed ${user.email}`);

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

console.log(`seed complete: ${created} created`);
