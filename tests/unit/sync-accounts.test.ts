import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, expect, it } from "vitest";
import { exportAccounts, importAccounts, initializeAuthSchema } from "@/lib/sync/accounts.mjs";
let root: string; let source: string; let target: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tesis-sync-accounts-")); source = join(root, "cloud.sqlite"); target = join(root, "pi.sqlite");
  const db = new Database(source); initializeAuthSchema(db);
  db.prepare('INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,role,banned) VALUES (?,?,?,?,?,?,?,?)').run("admin", "Admin", "admin@example.test", 1, 100, 100, "admin", 0);
  db.prepare('INSERT INTO account (id,userId,accountId,providerId,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("credential", "admin", "admin", "credential", "test-hash", 100, 100);
  db.prepare('INSERT INTO account (id,userId,accountId,providerId,accessToken,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run("oauth", "admin", "google-id", "google", "private-token", 100, 100); db.close();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
it("prepara acceso local conservando IDs y hashes sin OAuth", () => {
  const snapshot = exportAccounts(source);
  expect(JSON.stringify(snapshot)).not.toContain("private-token");
  expect(importAccounts(snapshot, target).count).toBe(1);
  const db = new Database(target);
  expect(db.prepare('SELECT id,email,role FROM user').get()).toEqual({ id: "admin", email: "admin@example.test", role: "admin" });
  expect(db.prepare('SELECT password FROM account').get()).toEqual({ password: "test-hash" });
  expect(db.prepare('SELECT count(*) AS n FROM session').get()).toEqual({ n: 0 }); db.close();
});
it("aplica cambios y revoca sesiones sin borrar sesiones por una descarga idéntica", () => {
  const snapshot = exportAccounts(source); importAccounts(snapshot, target);
  const db = new Database(target); db.prepare('INSERT INTO session (id,expiresAt,token,createdAt,updatedAt,userId) VALUES (?,?,?,?,?,?)').run("s", 9999, "token", 1, 1, "admin");
  importAccounts(snapshot, target); expect(db.prepare('SELECT count(*) AS n FROM session').get()).toEqual({ n: 1 });
  const cloud = new Database(source); cloud.prepare('UPDATE account SET password=? WHERE providerId=?').run("new-hash", "credential"); cloud.close();
  importAccounts(exportAccounts(source), target); expect(db.prepare('SELECT count(*) AS n FROM session').get()).toEqual({ n: 0 }); db.close();
});
it("rechaza colisiones y descargas parciales sin cambios parciales", () => {
  const db = new Database(target); initializeAuthSchema(db); db.prepare('INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,role) VALUES (?,?,?,?,?,?,?)').run("different", "Local", "admin@example.test", 1, 1, 1, "admin");
  expect(() => importAccounts(exportAccounts(source), target)).toThrow("Colisión");
  expect(db.prepare('SELECT id FROM user').all()).toEqual([{ id: "different" }]);
  expect(() => importAccounts({ ...exportAccounts(source), complete: false }, target)).toThrow("incompleta"); db.close();
});
