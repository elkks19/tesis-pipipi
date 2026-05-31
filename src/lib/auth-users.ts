import "server-only";

import Database from "better-sqlite3";

import type { AuthRole } from "@/lib/auth-role-values";

export type AuthUserListItem = {
  createdAt?: string | null;
  email: string;
  id: string;
  name: string;
  role: AuthRole | null;
};

export type AuthUserWithAccounts = AuthUserListItem & {
  providers: string[];
};

type AuthUserRow = {
  createdAt?: string | null;
  email: string;
  id: string;
  name: string;
  role: string | null;
};

const databasePath = process.env.BETTER_AUTH_SQLITE_PATH ?? "auth.sqlite";

export function listAuthUsers(): AuthUserListItem[] {
  const database = new Database(databasePath, {
    readonly: true,
  });

  try {
    const rows = database
      .prepare(
        'SELECT id, name, email, role, createdAt FROM "user" ORDER BY name COLLATE NOCASE ASC',
      )
      .all() as AuthUserRow[];

    return rows.map((row) => ({
      createdAt: row.createdAt,
      email: row.email,
      id: row.id,
      name: row.name,
      role: row.role as AuthRole | null,
    }));
  } finally {
    database.close();
  }
}

export function getAuthUsersByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const users = new Map<string, AuthUserListItem>();

  if (uniqueIds.length === 0) {
    return users;
  }

  const database = new Database(databasePath, {
    readonly: true,
  });

  try {
    const statement = database.prepare(
      'SELECT id, name, email, role, createdAt FROM "user" WHERE id = ?',
    );

    for (const id of uniqueIds) {
      const row = statement.get(id) as AuthUserRow | undefined;

      if (row) {
        users.set(row.id, {
          createdAt: row.createdAt,
          email: row.email,
          id: row.id,
          name: row.name,
          role: row.role as AuthRole | null,
        });
      }
    }

    return users;
  } finally {
    database.close();
  }
}

export function listAuthUsersWithAccounts(): AuthUserWithAccounts[] {
  const database = new Database(databasePath, {
    readonly: true,
  });

  try {
    const rows = database
      .prepare(
        `SELECT
          "user".id,
          "user".name,
          "user".email,
          "user".role,
          "user".createdAt,
          GROUP_CONCAT(account.providerId) AS providers
        FROM "user"
        LEFT JOIN account ON account.userId = "user".id
        GROUP BY "user".id
        ORDER BY "user".name COLLATE NOCASE ASC`,
      )
      .all() as (AuthUserRow & { providers: string | null })[];

    return rows.map((row) => ({
      createdAt: row.createdAt,
      email: row.email,
      id: row.id,
      name: row.name,
      providers: row.providers?.split(",").filter(Boolean) ?? [],
      role: row.role as AuthRole | null,
    }));
  } finally {
    database.close();
  }
}
